import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    
    // User client for auth and ownership verification
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // Service role client for bypassing RLS when inserting
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { conversationId } = await req.json();
    console.log('Received conversationId:', conversationId, 'length:', conversationId?.length, 'type:', typeof conversationId);
    
    // Verify conversation ownership using user client
    const { data: conversation } = await supabaseUser
      .from('conversations')
      .select('owned_by_profile')
      .eq('id', conversationId)
      .single();

    if (!conversation || conversation.owned_by_profile !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not own this conversation' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use service role to read ALL segments (not just last 30)
    const { data: segments } = await supabaseService
      .from('conversation_segments')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp_ms');
    
    if (!segments || segments.length === 0) {
      console.log('No conversation segments found');
      return new Response(
        JSON.stringify({ entities: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use ALL segments for better context - this is key for solo recordings!
    const transcript = segments.map(s => s.text).join('\n');
    console.log(`Processing ${segments.length} segments (${transcript.length} chars)`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Wrap OpenAI call in 25-second timeout to prevent edge function timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI request timed out after 25s')), 25000)
    );

    const openaiPromise = fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: "json_object" },
        messages: [{
          role: 'system',
          content: `You extract entities from VC/investor conversations. ALWAYS extract person names when mentioned.

ENTITY TYPES:
- "person_name": ANY person's full name (first + last name). ALWAYS extract these. Examples: "Roy Bahat", "Matt Hooper", "Sarah Chen"
- "sector": Industry/vertical (B2B SaaS, fintech, healthcare, AI/ML)
- "stage": Investment stage (pre-seed, seed, Series A, Series B)
- "check_size": Dollar amounts ($1M, $5 million, 1-5 million range)
- "geo": Locations (San Francisco, New York, Europe)
- "persona": Types of people, NOT names (founders, CTOs, investors)

CRITICAL RULES:
1. ALWAYS extract person_name when you see "FirstName LastName" pattern
2. "Roy Bahat" = person_name, NOT persona
3. "Matt Hooper" = person_name, NOT persona
4. "investors" = persona (no specific name)

Return JSON: {"entities": [{"entity_type": "...", "value": "...", "confidence": 0.9, "context_snippet": "..."}]}`
        }, {
          role: 'user',
          content: `Extract ALL entities from this transcript. ESPECIALLY extract any person names mentioned:\n\n${transcript}`
        }],
        temperature: 0.2,
      }),
    });

    const openaiResponse = await Promise.race([openaiPromise, timeoutPromise]) as Response;

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API failed: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('OpenAI response:', JSON.stringify(openaiData));
    
    if (!openaiData.choices || !openaiData.choices[0]) {
      throw new Error('Invalid OpenAI response: ' + JSON.stringify(openaiData));
    }
    
    let content = openaiData.choices[0].message.content;
    console.log('OpenAI content:', content);
    
    // Remove code blocks if present
    if (content.includes('```json')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.includes('```')) {
      content = content.replace(/```\n?/g, '');
    }
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content.trim());
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', content);
      console.error('Parse error:', parseError);
      // Return empty entities instead of throwing
      return new Response(
        JSON.stringify({ entities: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const entities = parsedResponse.entities || parsedResponse;
    console.log('Parsed entities:', JSON.stringify(entities));
    
    if (!Array.isArray(entities) || entities.length === 0) {
      console.log('No entities found');
      return new Response(
        JSON.stringify({ entities: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Delete existing entities for this conversation and insert new ones
    // This ensures we always have fresh, complete entity data
    await supabaseService
      .from('conversation_entities')
      .delete()
      .eq('conversation_id', conversationId);
    
    // Use service role client to insert entities (bypasses RLS)
    const { data: insertedEntities, error: insertError } = await supabaseService
      .from('conversation_entities')
      .insert(
        entities.map((e: any) => ({
          conversation_id: conversationId,
          entity_type: e.entity_type,
          value: e.value,
          confidence: (e.confidence != null ? e.confidence : 0.5).toString(),
          context_snippet: e.context_snippet,
        }))
      )
      .select();
    
    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }
    
    console.log('Inserted entities:', insertedEntities?.length || 0);
    
    return new Response(
      JSON.stringify({ entities: insertedEntities }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Extract entities error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

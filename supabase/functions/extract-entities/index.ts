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
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'system',
          content: `Extract investment entities AND person names from this VC/investor conversation. Return a JSON array with objects containing:
          - entity_type: one of ["sector", "stage", "check_size", "geo", "persona", "intent", "person_name"]
          - value: the extracted value
          - confidence: 0.0-1.0 confidence score
          - context_snippet: the relevant quote from the conversation
          
          CRITICAL DISTINCTION:
          - "person_name": Use when a SPECIFIC PERSON'S ACTUAL NAME is mentioned (e.g., "Matt Hooper", "Vance Weber", "Susan Schofer")
          - "persona": Use ONLY for TYPES/CATEGORIES of people (e.g., "founders", "enterprise buyers", "technical CTOs")
          
          Examples of "person_name" (use this type!):
          - "Matt Hooper would be a good match" → entity_type: "person_name", value: "Matt Hooper"
          - "I think Vance Weber could help" → entity_type: "person_name", value: "Vance Weber"
          - "Susan Schofer from SOSV" → entity_type: "person_name", value: "Susan Schofer"
          
          Examples of "persona" (different!):
          - "looking for technical founders" → entity_type: "persona", value: "technical founders"
          - "enterprise buyers" → entity_type: "persona", value: "enterprise buyers"
          
          Example output:
          [
            {
              "entity_type": "sector",
              "value": "B2B SaaS",
              "confidence": 0.95,
              "context_snippet": "It's a B2B SaaS startup"
            },
            {
              "entity_type": "person_name",
              "value": "Matt Hooper",
              "confidence": 0.95,
              "context_snippet": "good match for Matt Hooper"
            },
            {
              "entity_type": "person_name",
              "value": "Vance Weber",
              "confidence": 0.95,
              "context_snippet": "Vance is on the other side"
            }
          ]`
        }, {
          role: 'user',
          content: transcript
        }],
        temperature: 0.3,
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
    
    const entities = JSON.parse(content.trim());
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

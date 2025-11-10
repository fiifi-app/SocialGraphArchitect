import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { conversationId } = await req.json();
    
    // Verify conversation ownership
    const { data: conversation } = await supabase
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
    
    const { data: segments } = await supabase
      .from('conversation_segments')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp_ms');
    
    if (!segments || segments.length === 0) {
      throw new Error('No conversation segments found');
    }

    const transcript = segments.map(s => s.text).join('\n');
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: `Extract investment entities AND person names from this conversation. Return a JSON array with objects containing:
          - entity_type: one of ["sector", "stage", "check_size", "geo", "persona", "intent", "person_name"]
          - value: the extracted value
          - confidence: 0.0-1.0 confidence score
          - context_snippet: the relevant quote from the conversation
          
          IMPORTANT: When someone mentions a person's name in context of being a good match/intro (e.g., "Matt Hooper would be a good match" or "I think Vance Weber could help"), extract it with entity_type "person_name".
          
          Example output:
          [
            {
              "entity_type": "sector",
              "value": "B2B SaaS",
              "confidence": 0.95,
              "context_snippet": "It's a B2B SaaS startup"
            },
            {
              "entity_type": "stage",
              "value": "pre-seed",
              "confidence": 0.9,
              "context_snippet": "looking for pre-seed companies"
            },
            {
              "entity_type": "person_name",
              "value": "Matt Hooper",
              "confidence": 0.95,
              "context_snippet": "Matt Hooper would be a good match"
            }
          ]`
        }, {
          role: 'user',
          content: transcript
        }],
        temperature: 0.3,
      }),
    });

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
    
    const { data: insertedEntities, error: insertError } = await supabase
      .from('conversation_entities')
      .insert(
        entities.map((e: any) => ({
          conversation_id: conversationId,
          entity_type: e.entity_type,
          value: e.value,
          confidence: e.confidence.toString(),
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

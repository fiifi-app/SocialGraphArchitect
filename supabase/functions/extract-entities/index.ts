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
          content: `Extract investment entities from this conversation. Return a JSON array with objects containing:
          - entity_type: one of ["sector", "stage", "check_size", "geo", "persona", "intent"]
          - value: the extracted value
          - confidence: 0.0-1.0 confidence score
          - context_snippet: the relevant quote from the conversation
          
          Example output:
          [
            {
              "entity_type": "sector",
              "value": "FinTech",
              "confidence": 0.95,
              "context_snippet": "looking for FinTech companies"
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
    const entities = JSON.parse(openaiData.choices[0].message.content);
    
    const { data: insertedEntities } = await supabase
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
    
    return new Response(
      JSON.stringify({ entities: insertedEntities }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

    const { matchSuggestionId, conversationId } = await req.json();
    
    const { data: match } = await supabase
      .from('match_suggestions')
      .select(`
        *,
        contact:contacts (
          name,
          email,
          company,
          title
        )
      `)
      .eq('id', matchSuggestionId)
      .single();
    
    const { data: segments } = await supabase
      .from('conversation_segments')
      .select('text')
      .eq('conversation_id', conversationId)
      .order('timestamp_ms')
      .limit(10);
    
    const transcriptSnippets = segments?.map(s => s.text).slice(0, 4) || [];
    
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
          content: `Generate a warm, professional double opt-in introduction email.
          
          Include:
          - Brief introduction of both parties
          - 3-4 bullet points from the conversation that explain why this intro makes sense
          - Warm, conversational tone
          - Ask for permission to make the introduction
          
          Return JSON with:
          - subject: email subject line
          - body: full email body (HTML format)
          - bullets: array of 3-4 key points from conversation
          `
        }, {
          role: 'user',
          content: JSON.stringify({
            contact: match.contact,
            match_reasons: match.reasons,
            justification: match.justification,
            conversation_snippets: transcriptSnippets,
          })
        }],
        temperature: 0.7,
      }),
    });

    const openaiData = await openaiResponse.json();
    const email = JSON.parse(openaiData.choices[0].message.content);
    
    return new Response(
      JSON.stringify({ email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

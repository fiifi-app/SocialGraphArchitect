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
          content: `Generate a SHORT, high-impact double opt-in introduction email optimized for investor engagement.

CRITICAL RULES FOR INVESTOR EMAILS:
1. Subject line: Under 50 characters, specific to their focus area, creates curiosity (NOT "Introduction to X")
2. Body: 3-4 sentences MAX in opening paragraph
3. Structure: 
   - Personalized 1-sentence opener mentioning their specific focus
   - 1-2 specific reasons why THIS connection matters to THEM (not generic)
   - 1 clear CTA (request response, not permission)
4. Tone: Direct, respectful, assumes they'll be interested
5. NO fluff: Cut "I hope this finds you well", lengthy introductions, unnecessary pleasantries
6. Focus: What's in it for THEM, not the people being introduced

FORMATTING RULES - EXTREMELY IMPORTANT:
Generate email with these EXACT line breaks:
1. [Contact Name],\\n\\n
2. [1-2 sentence hook]\\n\\n
3. Key reason 1\\n
4. Key reason 2\\n\\n
5. [Call to action]\\n\\n
6. [Closing]

CRITICAL: Use TWO newlines (\\n\\n) between paragraphs and ONE newline (\\n) for bullet points within a section.

Example (with literal newlines shown as [NL]):
Sarah,[NL][NL]
You focus on B2B SaaS investments, and I think I have a great connection for you.[NL][NL]
- They're building in your target sector with proven traction[NL]
- Pre-seed stage, which matches your check size[NL][NL]
Would you be open to an intro?[NL][NL]
Best, [Your Name]

Return JSON with:
- subject: 40-50 character subject line
- body: Plain text with literal newlines - paragraph breaks use \\n\\n, inline breaks use \\n`,
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

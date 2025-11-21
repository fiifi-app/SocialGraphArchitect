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
    console.log('📧 Generating email for matchSuggestionId:', matchSuggestionId, 'conversationId:', conversationId);
    
    const { data: match, error: matchError } = await supabase
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
    
    if (matchError) {
      console.error('❌ Error fetching match:', matchError);
      throw new Error(`Failed to fetch match: ${matchError.message}`);
    }
    
    console.log('✅ Match data fetched:', match ? 'success' : 'null');
    
    // Fetch all conversation context data in parallel
    const [
      { data: segments, error: segmentsError },
      { data: entities, error: entitiesError },
      { data: participants, error: participantsError },
      { data: conversation, error: conversationError }
    ] = await Promise.all([
      supabase
        .from('conversation_segments')
        .select('text')
        .eq('conversation_id', conversationId)
        .order('timestamp_ms')
        .limit(10),
      supabase
        .from('conversation_entities')
        .select('entity_type, value, confidence, context_snippet')
        .eq('conversation_id', conversationId),
      supabase
        .from('conversation_participants')
        .select('contact_id, contacts(name, company, title)')
        .eq('conversation_id', conversationId),
      supabase
        .from('conversations')
        .select('title, duration_seconds')
        .eq('id', conversationId)
        .single()
    ]);
    
    if (segmentsError) console.error('❌ Error fetching segments:', segmentsError);
    if (entitiesError) console.error('❌ Error fetching entities:', entitiesError);
    if (participantsError) console.error('❌ Error fetching participants:', participantsError);
    if (conversationError) console.error('❌ Error fetching conversation:', conversationError);
    
    const transcriptSnippets = segments?.map(s => s.text).slice(0, 4) || [];
    console.log('✅ Transcript snippets:', transcriptSnippets.length);
    
    // Extract key entities for context
    const entityMap: { [key: string]: string[] } = {};
    entities?.forEach(e => {
      if (!entityMap[e.entity_type]) entityMap[e.entity_type] = [];
      entityMap[e.entity_type].push(e.value);
    });
    
    // Extract participants
    const participantsList = participants?.map(p => ({
      name: p.contacts?.name,
      company: p.contacts?.company,
      title: p.contacts?.title
    })) || [];
    
    console.log('✅ Entities:', Object.keys(entityMap).length, 'Participants:', participantsList.length);
    
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

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('✅ OpenAI response received');
    
    if (!openaiData.choices || !openaiData.choices[0]?.message?.content) {
      console.error('❌ Invalid OpenAI response format:', openaiData);
      throw new Error('Invalid OpenAI response format');
    }
    
    const email = JSON.parse(openaiData.choices[0].message.content);
    console.log('✅ Email generated successfully');
    
    return new Response(
      JSON.stringify({ email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('💥 Fatal error in generate-intro-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

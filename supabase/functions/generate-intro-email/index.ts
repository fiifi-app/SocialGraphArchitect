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
          title,
          bio,
          investor_notes,
          check_size_min,
          check_size_max
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
        .select('title, duration_seconds, target_person, matching_intent, goals_and_needs, domains_and_topics')
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
    
    // Safely parse JSONB fields - they may be strings or objects
    const parseJsonField = (field: any): any => {
      if (!field) return {};
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch { return {}; }
      }
      return typeof field === 'object' ? field : {};
    };
    
    // Extract rich context from conversation with safe parsing
    const goalsAndNeeds = parseJsonField(conversation?.goals_and_needs);
    const domainsAndTopics = parseJsonField(conversation?.domains_and_topics);
    const matchingIntent = parseJsonField(conversation?.matching_intent);
    
    // Build context string for the prompt with null guards
    let contextString = '';
    if (goalsAndNeeds?.fundraising && typeof goalsAndNeeds.fundraising === 'object') {
      const investorTypes = Array.isArray(goalsAndNeeds.fundraising.investor_types) 
        ? goalsAndNeeds.fundraising.investor_types.join(', ') 
        : 'investors';
      contextString += `\nFUNDRAISING CONTEXT: Looking for ${investorTypes}.`;
      if (goalsAndNeeds.fundraising.raise_amount) {
        contextString += ` Target: ${goalsAndNeeds.fundraising.raise_amount}.`;
      }
    }
    if (goalsAndNeeds?.hiring && Array.isArray(goalsAndNeeds.hiring?.roles_needed) && goalsAndNeeds.hiring.roles_needed.length > 0) {
      contextString += `\nHIRING CONTEXT: Looking for ${goalsAndNeeds.hiring.roles_needed.join(', ')}.`;
    }
    if (Array.isArray(domainsAndTopics?.sector_keywords) && domainsAndTopics.sector_keywords.length > 0) {
      contextString += `\nSECTORS: ${domainsAndTopics.sector_keywords.slice(0, 5).join(', ')}.`;
    }
    if (Array.isArray(domainsAndTopics?.technology_keywords) && domainsAndTopics.technology_keywords.length > 0) {
      contextString += `\nTECHNOLOGY: ${domainsAndTopics.technology_keywords.slice(0, 5).join(', ')}.`;
    }
    
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not configured');
      throw new Error('OpenAI API key not configured');
    }
    
    // Build rich contact context with null guards
    const safeSlice = (str: any, len: number): string | null => {
      if (typeof str === 'string') return str.slice(0, len);
      return null;
    };
    
    const contactContext = {
      name: match.contact?.name || 'Contact',
      title: match.contact?.title || null,
      company: match.contact?.company || null,
      bio: safeSlice(match.contact?.bio, 200),
      investorNotes: safeSlice(match.contact?.investor_notes, 200),
      checkSize: (match.contact?.check_size_min && match.contact?.check_size_max) 
        ? `$${(Number(match.contact.check_size_min) / 1000000).toFixed(1)}M - $${(Number(match.contact.check_size_max) / 1000000).toFixed(1)}M` 
        : null,
    };
    
    const userPrompt = `CONVERSATION SUMMARY:
${transcriptSnippets.join('\n').slice(0, 500)}
${contextString}

CONTACT TO INTRODUCE:
Name: ${contactContext.name}
${contactContext.title ? `Role: ${contactContext.title}` : ''}
${contactContext.company ? `Company: ${contactContext.company}` : ''}
${contactContext.bio ? `About: ${contactContext.bio}` : ''}
${contactContext.investorNotes ? `Investment Focus: ${contactContext.investorNotes}` : ''}
${contactContext.checkSize ? `Check Size: ${contactContext.checkSize}` : ''}

MATCH DETAILS:
Reasons: ${match.reasons?.join(', ')}
${match.ai_explanation ? `Why This Matters: ${match.ai_explanation}` : ''}

Generate a professional double opt-in introduction email. Return ONLY valid JSON with exactly these two fields:
{"subject": "...", "body": "..."}

Subject: Under 50 chars, specific to their focus area or expertise
Body: 3-4 sentences. Start by referencing the conversation topic. Explain the specific mutual benefit. End with a clear ask.`;
    
    console.log('📤 Sending request to OpenAI...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `You are an expert at writing professional introduction emails for investors. 
Generate ONLY a valid JSON object with "subject" and "body" fields.
Do NOT include markdown, code blocks, or any text outside the JSON.`
        }, {
          role: 'user',
          content: userPrompt
        }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API error:', openaiResponse.status);
      console.error('❌ Error details:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText.substring(0, 200)}`);
    }

    let openaiData;
    try {
      openaiData = await openaiResponse.json();
    } catch (e) {
      console.error('❌ Failed to parse OpenAI response as JSON');
      throw new Error('Invalid response from OpenAI');
    }
    
    console.log('✅ OpenAI response received');
    
    if (!openaiData.choices || !openaiData.choices[0]?.message?.content) {
      console.error('❌ Invalid OpenAI response format:', JSON.stringify(openaiData).substring(0, 200));
      throw new Error('Invalid OpenAI response format - missing choices');
    }
    
    let emailContent = openaiData.choices[0].message.content.trim();
    console.log('📝 Raw response:', emailContent.substring(0, 150));
    
    // Remove markdown code blocks
    emailContent = emailContent
      .replace(/^```json\s*\n?/i, '')
      .replace(/^```\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    
    // Extract JSON if it's embedded in text
    const jsonMatch = emailContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      emailContent = jsonMatch[0];
    }
    
    console.log('📝 Cleaned content:', emailContent.substring(0, 150));
    
    let email;
    try {
      email = JSON.parse(emailContent);
    } catch (parseError) {
      console.error('❌ JSON parse failed');
      console.error('❌ Content:', emailContent.substring(0, 300));
      throw new Error(`Failed to parse email JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    if (!email.subject || !email.body) {
      console.error('❌ Missing fields. Got:', Object.keys(email));
      throw new Error('Email missing subject or body field');
    }
    
    // Ensure body is a string
    if (typeof email.body !== 'string') {
      email.body = String(email.body);
    }
    if (typeof email.subject !== 'string') {
      email.subject = String(email.subject);
    }
    
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

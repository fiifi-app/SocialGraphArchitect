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
    
    // Service role client for bypassing RLS when reading/writing
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
    
    // Use service role to read entities and contacts (bypasses RLS)
    const { data: entities } = await supabaseService
      .from('conversation_entities')
      .select('*')
      .eq('conversation_id', conversationId);
    
    const { data: contacts } = await supabaseService
      .from('contacts')
      .select(`
        *,
        theses (*)
      `)
      .eq('owned_by_profile', user.id);
    
    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Separate person names from other entities
    const personNames = entities?.filter(e => e.entity_type === 'person_name').map(e => e.value.toLowerCase()) || [];
    const otherEntities = entities?.filter(e => e.entity_type !== 'person_name') || [];
    
    const entitySummary = otherEntities.reduce((acc, e) => {
      if (!acc[e.entity_type]) acc[e.entity_type] = [];
      acc[e.entity_type].push(e.value);
      return acc;
    }, {} as Record<string, string[]>);

    console.log('Entity summary:', entitySummary);
    console.log('Person names mentioned:', personNames);

    // Direct name matches - find contacts whose names were mentioned
    const nameMatches = contacts.filter(c => 
      personNames.some(name => c.name?.toLowerCase().includes(name) || name.includes(c.name?.toLowerCase()))
    ).map(c => ({
      contact_id: c.id,
      contact_name: c.name,
      score: 3, // Person mentioned by name = 3 stars
      reasons: ['Mentioned by name in conversation'],
      justification: `${c.name} was specifically mentioned as a potential match during the conversation.`,
    }));

    console.log('Name matches found:', nameMatches.length);

    // Only call OpenAI if there are other entities to match
    let aiMatches: any[] = [];
    if (Object.keys(entitySummary).length > 0) {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Limit contacts to 100 to avoid payload size issues and timeout
      const limitedContacts = contacts.slice(0, 100);
      console.log(`Processing ${limitedContacts.length} contacts for matching`);

      // Wrap OpenAI call in 25-second timeout
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
          content: `You are a relationship matching engine for VCs and investors. 
          Score each contact based on how well their thesis matches the conversation entities.
          
          IMPORTANT: Partial matches are valuable! Contacts don't need to match ALL criteria.
          Even if only one field matches (e.g., just "pre-seed" stage), include it as a match.
          
          Scoring guidelines:
          - 3 stars: Strong match (3+ overlapping criteria OR perfect fit for key criteria)
          - 2 stars: Medium match (2 overlapping criteria OR good fit on important criteria)
          - 1 star: Weak match (1 overlapping criterion OR relevant but not perfect fit)
          
          Match on ANY of these:
          - Investment stage (pre-seed, seed, Series A, etc.)
          - Sector/vertical (B2B SaaS, fintech, healthcare, AI, etc.)
          - Check size ($1M, $5M, etc.)
          - Geography (SF Bay Area, NYC, remote, etc.)
          - Persona type (GP, angel, family office, etc.)
          
          Return JSON array (include ALL matches, even 1-star):
          - contact_id: string
          - score: number (1-3)
          - reasons: string[] (what matched, e.g., ["stage: pre-seed", "sector: B2B SaaS"])
          - justification: string (brief explanation why this is a good intro)
          `
        }, {
          role: 'user',
          content: JSON.stringify({
            entities: entitySummary,
            contacts: limitedContacts.map(c => ({
              id: c.id,
              name: c.name,
              company: c.company,
              theses: c.theses
            }))
          })
        }],
        temperature: 0.5,
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
        console.error('Invalid OpenAI response:', openaiData);
        aiMatches = [];
      } else {
        let content = openaiData.choices[0].message.content;
        console.log('OpenAI content:', content);
        
        // Remove code blocks if present
        if (content.includes('```json')) {
          content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (content.includes('```')) {
          content = content.replace(/```\n?/g, '');
        }
        
        try {
          aiMatches = JSON.parse(content.trim());
          console.log('AI matches parsed:', aiMatches.length);
          
          // Add contact names to AI matches
          aiMatches = aiMatches.map((m: any) => {
            const contact = contacts.find(c => c.id === m.contact_id);
            return {
              ...m,
              contact_name: contact?.name || 'Unknown',
            };
          });
        } catch (parseError) {
          console.error('Failed to parse AI matches:', parseError);
          aiMatches = [];
        }
      }
    }
    
    // Merge name matches and AI matches, removing duplicates
    const allMatches = [...nameMatches];
    const nameMatchIds = new Set(nameMatches.map(m => m.contact_id));
    
    for (const aiMatch of aiMatches) {
      if (!nameMatchIds.has(aiMatch.contact_id)) {
        allMatches.push(aiMatch);
      }
    }
    
    console.log('Total matches:', allMatches.length, '(name:', nameMatches.length, ', AI:', aiMatches.length, ')');
    
    if (allMatches.length === 0) {
      console.log('No matches found');
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use service role client to insert matches (bypasses RLS)
    const { data: insertedMatches, error: insertError } = await supabaseService
      .from('match_suggestions')
      .insert(
        allMatches.map((m: any) => ({
          conversation_id: conversationId,
          contact_id: m.contact_id,
          score: m.score,
          reasons: m.reasons,
          justification: m.justification,
          status: 'pending',
        }))
      )
      .select();
    
    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }
    
    console.log('Inserted matches:', insertedMatches?.length || 0);
    
    return new Response(
      JSON.stringify({ matches: insertedMatches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate matches error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

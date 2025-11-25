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
    console.log('🔍 Received conversationId:', conversationId, 'length:', conversationId?.length, 'type:', typeof conversationId);
    
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
    
    // Use service role to read entities (bypasses RLS)
    const { data: entities, error: entitiesError } = await supabaseService
      .from('conversation_entities')
      .select('*')
      .eq('conversation_id', conversationId);
    
    if (entitiesError) {
      console.error('Failed to fetch entities:', entitiesError);
    }
    
    console.log('Fetched entities:', entities?.length || 0);
    
    // Fetch only essential contact fields to avoid timeout with large datasets
    // Split into investor-prioritized contacts (first 500) for efficiency
    const { data: contacts, error: contactsError } = await supabaseService
      .from('contacts')
      .select(`
        id,
        name,
        first_name,
        last_name,
        title,
        company,
        bio,
        investor_notes,
        contact_type,
        check_size_min,
        check_size_max,
        is_investor,
        theses (
          sectors,
          stages
        )
      `)
      .eq('owned_by_profile', user.id)
      .order('is_investor', { ascending: false })
      .limit(1000);  // Limit to 1000 contacts to prevent timeout
    
    if (contactsError) {
      console.error('Failed to fetch contacts:', contactsError);
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }
    
    console.log('Fetched contacts:', contacts?.length || 0);
    
    if (!contacts || contacts.length === 0) {
      console.log('No contacts found for user');
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
    console.log('Total contacts to search:', contacts.length);

    // Enhanced name matching - handle first/last name variations
    const nameMatches = contacts.filter(c => {
      if (!c.name) return false;
      
      const contactNameLower = c.name.toLowerCase();
      
      return personNames.some(mentionedName => {
        // Try exact match first
        if (contactNameLower.includes(mentionedName) || mentionedName.includes(contactNameLower)) {
          return true;
        }
        
        // Split into first/last name and try matching both parts
        const mentionedParts = mentionedName.split(/\s+/).filter(p => p.length > 0);
        const contactParts = contactNameLower.split(/\s+/).filter(p => p.length > 0);
        
        // If we have at least 2 parts (first + last), check if both exist in contact name
        if (mentionedParts.length >= 2) {
          const firstName = mentionedParts[0];
          const lastName = mentionedParts[mentionedParts.length - 1];
          
          // Check if both first and last name appear in the contact name
          const hasFirstName = contactParts.some(part => part.includes(firstName) || firstName.includes(part));
          const hasLastName = contactParts.some(part => part.includes(lastName) || lastName.includes(part));
          
          if (hasFirstName && hasLastName) {
            console.log(`✅ Name match: "${mentionedName}" matched with "${c.name}"`);
            return true;
          }
        }
        
        return false;
      });
    }).map(c => ({
      contact_id: c.id,
      contact_name: c.name,
      score: 3, // Person mentioned by name = 3 stars
      reasons: ['Mentioned by name in conversation'],
      justification: `${c.name} was specifically mentioned as a potential match during the conversation.`,
    }));

    console.log('Name matches found:', nameMatches.length);
    if (nameMatches.length > 0) {
      console.log('Matched contacts:', nameMatches.map(m => m.contact_name).join(', '));
    }

    // Only call OpenAI if there are other entities to match
    let aiMatches: any[] = [];
    if (Object.keys(entitySummary).length > 0) {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Prioritize contacts: investors first, then those with theses, limit to 100
      const prioritizedContacts = contacts
        .sort((a, b) => {
          // Investors with theses first
          const aScore = (a.is_investor ? 2 : 0) + (a.theses?.length > 0 ? 1 : 0);
          const bScore = (b.is_investor ? 2 : 0) + (b.theses?.length > 0 ? 1 : 0);
          return bScore - aScore;
        })
        .slice(0, 100); // Limit to 100 contacts to stay within token limits

      console.log(`Processing ${prioritizedContacts.length} prioritized contacts (from ${contacts.length} total)`);

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
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `You are a relationship matching engine for VCs and investors. 
Score contacts based on how well they match conversation entities.

MATCHING CRITERIA (in order):
1. Sector/Vertical (B2B SaaS, fintech, healthcare, AI/ML, etc.)
2. Investment Stage (pre-seed, seed, Series A, B+, growth)
3. Check Size Range
4. Investor Type (GP, LP, Angel, Family Office, PE)
5. Professional Experience

Scoring:
- 3 stars: 2+ criteria match strongly
- 2 stars: 1 criterion matches
- 1 star: Weak/partial match

Return JSON array ONLY (no markdown, no explanation):
[{"contact_id":"uuid","score":1-3,"reasons":["reason1"],"justification":"brief why"}]

If no matches, return: []`
        }, {
          role: 'user',
          content: JSON.stringify({
            entities: entitySummary,
            contacts: prioritizedContacts.map(c => ({
              id: c.id,
              name: c.name,
              title: c.title,
              company: c.company,
              bio: c.bio?.substring(0, 200),
              theses: c.theses?.map((t: any) => ({ sectors: t.sectors, stages: t.stages })),
              investorNotes: c.investor_notes?.substring(0, 200),
              contactType: c.contact_type,
              checkSizeMin: c.check_size_min,
              checkSizeMax: c.check_size_max,
              isInvestor: c.is_investor,
            }))
          })
        }],
        temperature: 0.3,
        max_tokens: 2000,
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
    
    // Use service role client to upsert matches (bypasses RLS, handles duplicates)
    const matchRecords = allMatches.map((m: any) => ({
      conversation_id: conversationId,
      contact_id: m.contact_id,
      score: m.score,
      reasons: m.reasons,
      justification: m.justification,
      status: 'pending',
    }));
    
    // Insert new matches only (skip existing ones)
    const insertedMatches: any[] = [];
    for (const record of matchRecords) {
      const { data, error } = await supabaseService
        .from('match_suggestions')
        .upsert(record, { 
          onConflict: 'conversation_id,contact_id',
          ignoreDuplicates: false 
        })
        .select(`
          id,
          conversation_id,
          contact_id,
          score,
          reasons,
          justification,
          status,
          created_at,
          contacts:contact_id ( name )
        `)
        .single();
      
      if (!error && data) {
        insertedMatches.push(data);
      } else if (error) {
        console.log('Upsert note for contact:', record.contact_id, error.message);
      }
    }
    
    console.log('Upserted matches:', insertedMatches.length);
    
    // Flatten nested contact names
    const matchesWithNames = insertedMatches?.map((m: any) => ({
      ...m,
      contact_name: m.contacts?.name ?? null
    })) || [];
    
    return new Response(
      JSON.stringify({ matches: matchesWithNames }),
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

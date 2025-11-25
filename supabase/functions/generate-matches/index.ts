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

      // Process ALL contacts, not just first 100 - this is critical for quality!
      console.log(`Processing ${contacts.length} contacts for matching`);

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
          Score each contact based on how well their investment thesis and profile match the conversation entities.
          Consider ALL contact information:
          - Investment theses (sectors, stages, check sizes)
          - Contact's title, company, and experience
          - Investor type (GP, LP, Angel, Family Office, PE)
          - Check size ranges
          - Company information (size, founded date, business focus)
          - Conversation topics and entities mentioned
          
          PRIORITY MATCHING CRITERIA (in order of importance):
          1. Sector/Vertical Match - MOST IMPORTANT: B2B SaaS, fintech, healthcare, AI/ML, biotech, etc.
          2. Investment Stage - CRITICAL: pre-seed, seed, Series A, Series B+, growth
          3. Thesis Alignment - CRITICAL: How well contact's stated investment thesis matches conversation
          4. Check Size Range - CRITICAL: Investment amount range matches conversation mentions
          5. Investor Type - IMPORTANT: GP, Angel, Family Office, LP, PE match conversation context
          6. Professional Experience - SECONDARY: Founder background, operating experience
          7. Company Focus - SECONDARY: Industry relevance and business model
          8. Geography - DE-EMPHASIZED: Use only as a secondary signal if all else is equal
          
          IMPORTANT: Use the ENTIRE contact profile for rich matching:
          1. Even without a formal thesis, use title/company to infer investment interests
          2. For solo recordings or single-person conversations, match more aggressively
          3. Partial matches are valuable! Contacts don't need to match ALL criteria.
          4. Prioritize sector, stage, thesis, and check size above all other signals
          5. Geography should NOT be a primary reason for matching
          
          Scoring guidelines:
          CORE CRITERIA (weight: 2x):
          - 3 stars: TWO OR MORE core criteria match (Sector, Stage, Thesis, Check Size)
          - 2 stars: ONE core criterion matches
          
          WITH SECONDARY CRITERIA (weight: 1x):
          - 3 stars: ONE core + TWO OR MORE secondary criteria (Investor Type, Experience, Company Focus, Geography)
          - 2 stars: ONE core + ONE secondary, OR THREE OR MORE secondary criteria
          - 1 star: ONE OR TWO secondary criteria only
          
          Priority scoring:
          - 3 stars: (2+ core) OR (1 core + 2+ secondary)
          - 2 stars: (1 core) OR (1 core + 1 secondary) OR (3+ secondary)
          - 1 star: (1-2 secondary only)
          
          Match on THESE criteria (prioritized):
          1. Investment stage (pre-seed, seed, Series A, Series B+, growth, etc.) - PRIMARY
          2. Sector/vertical (B2B SaaS, fintech, healthcare, AI/ML, biotech, etc.) - PRIMARY
          3. Thesis alignment - PRIMARY
          4. Check size range (matches conversation amounts mentioned) - PRIMARY
          5. Investor type (GP, Angel, Family Office, LP, PE) - SECONDARY
          6. Professional experience (founder background, operating experience) - SECONDARY
          7. Company focus/industry relevance - SECONDARY
          
          Return JSON array (include matches with 1+ of core criteria OR 2+ of secondary criteria):
          - contact_id: string
          - score: number (1-3, based on criteria matched)
          - reasons: string[] (what matched from BOTH core and secondary criteria, e.g., ["sector: B2B SaaS", "stage: Series A", "investor_type: Angel", "experience: Founder background"])
          - justification: string (brief explanation why this is a good intro based on all matched criteria)`
        }, {
          role: 'user',
          content: JSON.stringify({
            entities: entitySummary,
            contacts: contacts.map(c => ({
              id: c.id,
              name: c.name,
              firstName: c.first_name,
              lastName: c.last_name,
              title: c.title,
              company: c.company,
              email: c.email,
              location: c.location,
              linkedinUrl: c.linkedin_url,
              twitter: c.twitter,
              angellist: c.angellist,
              bio: c.bio,
              phone: c.phone,
              category: c.category,
              companyAddress: c.company_address,
              companyEmployees: c.company_employees,
              companyFounded: c.company_founded,
              companyUrl: c.company_url,
              companyLinkedin: c.company_linkedin,
              companyTwitter: c.company_twitter,
              companyFacebook: c.company_facebook,
              companyAngellist: c.company_angellist,
              companyCrunchbase: c.company_crunchbase,
              companyOwler: c.company_owler,
              youtubeVimeo: c.youtube_vimeo,
              theses: c.theses,
              investorNotes: c.investor_notes,
              contactType: c.contact_type,
              checkSizeMin: c.check_size_min,
              checkSizeMax: c.check_size_max,
              isInvestor: c.is_investor,
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

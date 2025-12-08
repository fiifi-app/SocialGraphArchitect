import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RICH_EXTRACTION_PROMPT = `You are an AI assistant that analyzes conversation transcripts to identify
people being discussed and to determine how to best match them to contacts
in a relationship graph.

You will be given:
- A transcript excerpt of a real-time conversation.
- The app owner is one of the speakers. They may be speaking alone (notes to self)
  or with another person (the "target person").

Your job is to:
1. Identify the main "target person" the owner is currently thinking about
   helping, selling to, or talking with.
2. Infer that person's key attributes (even if not stated explicitly).
3. Extract keywords and tags useful for matching to other contacts.
4. Suggest normalized spellings for names and companies when possible.
5. Identify what kind of people/intros would be MOST USEFUL to this target person.

You MUST respond with STRICT JSON. Do not include any extra text.

JSON schema (all fields required, but you may use null or empty arrays where needed):

{
  "target_person": {
    "is_current_conversation_partner": boolean,
    "name_mentioned": string | null,
    "normalized_name_guess": string | null,
    "role_title": string | null,
    "company_mentioned": string | null,
    "normalized_company_guess": string | null,
    "seniority_level": string | null,
    "relationship_to_owner": string | null,
    "location_city": string | null,
    "location_country": string | null,
    "communication_context": string
  },
  "current_goals_and_needs": {
    "fundraising": {
      "is_relevant": boolean,
      "stage": string | null,
      "amount_range": string | null,
      "investor_types": []
    },
    "hiring": {
      "is_relevant": boolean,
      "roles_needed": [],
      "seniority": []
    },
    "customers_or_partners": {
      "is_relevant": boolean,
      "ideal_customer_types": [],
      "partner_types": []
    },
    "other_needs": []
  },
  "domains_and_topics": {
    "primary_industry": string | null,
    "secondary_industries": [],
    "product_keywords": [],
    "business_model_keywords": [],
    "technology_keywords": [],
    "stage_keywords": [],
    "geography_keywords": []
  },
  "matching_intent": {
    "what_kind_of_contacts_to_find": [],
    "hard_constraints": [],
    "soft_preferences": [],
    "urgency": string | null
  },
  "extracted_keywords_for_matching": {
    "names_mentioned": [],
    "companies_mentioned": [],
    "free_form_keywords": []
  },
  "legacy_entities": []
}

Instructions:
- Always assume there is exactly ONE primary target person for the current moment.
- If the owner is speaking only about themselves and their own needs, treat the owner as the target_person.
- If you are unsure about a value, set it to null or an empty array; do NOT invent specific names or numbers.
- For normalized_name_guess and normalized_company_guess, try to correct obvious typos
  (e.g. "Seqouia" → "Sequoia Capital") but ONLY if you are at least 70% confident.
- Be conservative with normalization; when in doubt, leave the normalized_* field as null.
- The legacy_entities array should contain objects with: {"entity_type": "person_name|sector|stage|check_size|geo|persona", "value": "...", "confidence": 0.9}
- ALWAYS extract person names (first + last) into both names_mentioned AND legacy_entities with entity_type "person_name"
- Do NOT include any commentary outside the JSON.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { conversationId } = await req.json();
    console.log('Received conversationId:', conversationId);
    
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
    
    const { data: segments } = await supabaseService
      .from('conversation_segments')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp_ms');
    
    if (!segments || segments.length === 0) {
      console.log('No conversation segments found');
      return new Response(
        JSON.stringify({ entities: [], richContext: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcript = segments.map(s => s.text).join('\n');
    console.log(`Processing ${segments.length} segments (${transcript.length} chars)`);
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

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
        response_format: { type: "json_object" },
        messages: [{
          role: 'system',
          content: RICH_EXTRACTION_PROMPT
        }, {
          role: 'user',
          content: `Analyze this conversation transcript and extract all relevant information:\n\n${transcript}`
        }],
        temperature: 0.2,
      }),
    });

    const openaiResponse = await Promise.race([openaiPromise, timeoutPromise]) as Response;

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API failed: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('OpenAI response received');
    
    if (!openaiData.choices || !openaiData.choices[0]) {
      throw new Error('Invalid OpenAI response: ' + JSON.stringify(openaiData));
    }
    
    let content = openaiData.choices[0].message.content;
    
    if (content.includes('```json')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (content.includes('```')) {
      content = content.replace(/```\n?/g, '');
    }
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content.trim());
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', content);
      return new Response(
        JSON.stringify({ entities: [], richContext: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Parsed rich context:', JSON.stringify(parsedResponse).substring(0, 500));
    
    // Extract legacy entities for backward compatibility
    const legacyEntities = parsedResponse.legacy_entities || [];
    
    // Also add names from names_mentioned to legacy entities
    const namesMentioned = parsedResponse.extracted_keywords_for_matching?.names_mentioned || [];
    for (const name of namesMentioned) {
      if (!legacyEntities.find((e: any) => e.entity_type === 'person_name' && e.value === name)) {
        legacyEntities.push({ entity_type: 'person_name', value: name, confidence: 0.9 });
      }
    }
    
    // Add companies to legacy entities
    const companiesMentioned = parsedResponse.extracted_keywords_for_matching?.companies_mentioned || [];
    for (const company of companiesMentioned) {
      legacyEntities.push({ entity_type: 'company', value: company, confidence: 0.9 });
    }
    
    // Add sectors from domains_and_topics
    if (parsedResponse.domains_and_topics?.primary_industry) {
      legacyEntities.push({ entity_type: 'sector', value: parsedResponse.domains_and_topics.primary_industry, confidence: 0.9 });
    }
    for (const industry of parsedResponse.domains_and_topics?.secondary_industries || []) {
      legacyEntities.push({ entity_type: 'sector', value: industry, confidence: 0.8 });
    }
    
    // Add stages from stage_keywords
    for (const stage of parsedResponse.domains_and_topics?.stage_keywords || []) {
      legacyEntities.push({ entity_type: 'stage', value: stage, confidence: 0.85 });
    }
    
    // Add fundraising stage if relevant
    if (parsedResponse.current_goals_and_needs?.fundraising?.is_relevant) {
      const stage = parsedResponse.current_goals_and_needs.fundraising.stage;
      if (stage) {
        legacyEntities.push({ entity_type: 'stage', value: stage, confidence: 0.95 });
      }
      const amount = parsedResponse.current_goals_and_needs.fundraising.amount_range;
      if (amount) {
        legacyEntities.push({ entity_type: 'check_size', value: amount, confidence: 0.9 });
      }
    }
    
    // Add geos from geography_keywords
    for (const geo of parsedResponse.domains_and_topics?.geography_keywords || []) {
      legacyEntities.push({ entity_type: 'geo', value: geo, confidence: 0.85 });
    }
    
    // Add target person location if available
    if (parsedResponse.target_person?.location_city) {
      legacyEntities.push({ entity_type: 'geo', value: parsedResponse.target_person.location_city, confidence: 0.9 });
    }
    
    console.log('Legacy entities extracted:', legacyEntities.length);
    
    // Delete existing entities for this conversation
    await supabaseService
      .from('conversation_entities')
      .delete()
      .eq('conversation_id', conversationId);
    
    // Insert legacy entities for backward compatibility
    let insertedEntities: any[] = [];
    if (legacyEntities.length > 0) {
      const { data: inserted, error: insertError } = await supabaseService
        .from('conversation_entities')
        .insert(
          legacyEntities.map((e: any) => ({
            conversation_id: conversationId,
            entity_type: e.entity_type,
            value: e.value,
            confidence: (e.confidence != null ? e.confidence : 0.5).toString(),
            context_snippet: e.context_snippet || null,
          }))
        )
        .select();
      
      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
      insertedEntities = inserted || [];
    }
    
    console.log('Inserted entities:', insertedEntities.length);
    
    // Build rich context object
    const richContext = {
      target_person: parsedResponse.target_person,
      current_goals_and_needs: parsedResponse.current_goals_and_needs,
      domains_and_topics: parsedResponse.domains_and_topics,
      matching_intent: parsedResponse.matching_intent,
      extracted_keywords: parsedResponse.extracted_keywords_for_matching,
    };
    
    // Store rich context in conversations table (Phase 1B)
    const { error: updateError } = await supabaseService
      .from('conversations')
      .update({
        target_person: parsedResponse.target_person,
        matching_intent: parsedResponse.matching_intent,
        goals_and_needs: parsedResponse.current_goals_and_needs,
        domains_and_topics: parsedResponse.domains_and_topics,
      })
      .eq('id', conversationId);
    
    if (updateError) {
      console.error('Failed to update conversation with rich context:', updateError);
    } else {
      console.log('Saved rich context to conversation');
    }
    
    // Phase 1C: Auto-append conversation summary to contact's notes
    // Find matching contacts and update their investor_notes with conversation context
    const targetName = parsedResponse.target_person?.normalized_name_guess || parsedResponse.target_person?.name_mentioned;
    const targetCompany = parsedResponse.target_person?.normalized_company_guess || parsedResponse.target_person?.company_mentioned;
    const communicationContext = parsedResponse.target_person?.communication_context;
    
    if (targetName && communicationContext) {
      // Try to find a matching contact
      const { data: matchingContacts } = await supabaseService
        .from('contacts')
        .select('id, name, investor_notes, bio')
        .eq('owned_by_profile', user.id)
        .or(`name.ilike.%${targetName}%,company.ilike.%${targetCompany || 'NOMATCH'}%`)
        .limit(1);
      
      if (matchingContacts && matchingContacts.length > 0) {
        const contact = matchingContacts[0];
        const today = new Date().toISOString().split('T')[0];
        const newNote = `[${today}] ${communicationContext}`;
        
        // Append to investor_notes
        const existingNotes = contact.investor_notes || '';
        const updatedNotes = existingNotes 
          ? `${existingNotes}\n\n${newNote}`
          : newNote;
        
        const { error: noteError } = await supabaseService
          .from('contacts')
          .update({ investor_notes: updatedNotes })
          .eq('id', contact.id);
        
        if (noteError) {
          console.error('Failed to update contact notes:', noteError);
        } else {
          console.log(`Appended conversation summary to contact: ${contact.name}`);
        }
      }
    }
    
    const matchingIntentSummary = parsedResponse.matching_intent?.what_kind_of_contacts_to_find?.join('; ') || null;
    const targetPersonSummary = parsedResponse.target_person?.communication_context || null;
    
    return new Response(
      JSON.stringify({ 
        entities: insertedEntities,
        richContext,
        matchingIntentSummary,
        targetPersonSummary,
      }),
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

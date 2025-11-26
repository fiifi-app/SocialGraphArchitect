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
    
    const { data: entities } = await supabaseService
      .from('conversation_entities')
      .select('*')
      .eq('conversation_id', conversationId);
    
    const { data: contacts } = await supabaseService
      .from('contacts')
      .select(`
        id, name, first_name, last_name, title, company, location, bio,
        category, contact_type, check_size_min, check_size_max, is_investor,
        theses (id, sectors, stages, check_size_min, check_size_max)
      `)
      .eq('owned_by_profile', user.id);
    
    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const personNames = entities?.filter(e => e.entity_type === 'person_name').map(e => e.value.toLowerCase()) || [];
    const otherEntities = entities?.filter(e => e.entity_type !== 'person_name') || [];
    
    const entitySummary = otherEntities.reduce((acc, e) => {
      if (!acc[e.entity_type]) acc[e.entity_type] = [];
      acc[e.entity_type].push(e.value);
      return acc;
    }, {} as Record<string, string[]>);

    console.log('Entity summary:', entitySummary);
    console.log('Person names mentioned:', personNames);
    console.log('Total contacts:', contacts.length);

    // Name matching for person names mentioned
    const nameMatches = contacts.filter(c => {
      if (!c.name) return false;
      const contactNameLower = c.name.toLowerCase();
      
      return personNames.some(mentionedName => {
        if (contactNameLower.includes(mentionedName) || mentionedName.includes(contactNameLower)) {
          return true;
        }
        
        const mentionedParts = mentionedName.split(/\s+/).filter(p => p.length > 0);
        const contactParts = contactNameLower.split(/\s+/).filter(p => p.length > 0);
        
        if (mentionedParts.length >= 2) {
          const firstName = mentionedParts[0];
          const lastName = mentionedParts[mentionedParts.length - 1];
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
      score: 3,
      reasons: ['Mentioned by name in conversation'],
      justification: `${c.name} was specifically mentioned as a potential match during the conversation.`,
    }));

    console.log('Name matches found:', nameMatches.length);

    // PRE-FILTER contacts before sending to OpenAI
    let aiMatches: any[] = [];
    if (Object.keys(entitySummary).length > 0) {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Extract keywords from entities for pre-filtering
      const sectors = entitySummary['sector'] || [];
      const stages = entitySummary['stage'] || [];
      const geos = entitySummary['geo'] || [];
      const allKeywords = [...sectors, ...stages, ...geos].map(k => k.toLowerCase());
      
      console.log('Pre-filter keywords:', allKeywords);

      // Pre-filter: only contacts with matching thesis/profile keywords
      const preFilteredContacts = contacts.filter(c => {
        // Skip contacts already matched by name
        if (nameMatches.some(nm => nm.contact_id === c.id)) return false;
        
        // Check thesis sectors/stages
        const theses = c.theses || [];
        for (const thesis of theses) {
          const thesisSectors = (thesis.sectors || []).map((s: string) => s.toLowerCase());
          const thesisStages = (thesis.stages || []).map((s: string) => s.toLowerCase());
          
          for (const keyword of allKeywords) {
            if (thesisSectors.some((s: string) => s.includes(keyword) || keyword.includes(s))) return true;
            if (thesisStages.some((s: string) => s.includes(keyword) || keyword.includes(s))) return true;
          }
        }
        
        // Check contact fields
        const searchableText = [
          c.title || '',
          c.company || '',
          c.bio || '',
          c.category || '',
          c.location || '',
        ].join(' ').toLowerCase();
        
        for (const keyword of allKeywords) {
          if (searchableText.includes(keyword)) return true;
        }
        
        // Include investors even without keyword match (they have investment potential)
        if (c.is_investor) return true;
        
        return false;
      });

      // Limit to 200 contacts max for OpenAI
      const contactsForAI = preFilteredContacts.slice(0, 200);
      console.log(`Pre-filtered from ${contacts.length} to ${preFilteredContacts.length}, sending ${contactsForAI.length} to OpenAI`);

      if (contactsForAI.length > 0) {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI request timed out after 20s')), 20000)
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
Score contacts based on how well they match the conversation entities.

SCORING:
- 3 stars: Strong match (2+ criteria match: sector, stage, thesis, check size)
- 2 stars: Good match (1 core criterion matches)
- 1 star: Weak match (secondary criteria only)

Return JSON array with up to 10 best matches:
[{"contact_id": "uuid", "score": 1-3, "reasons": ["reason1"], "justification": "brief explanation"}]

Only include contacts with score >= 1. Return empty array [] if no good matches.`
            }, {
              role: 'user',
              content: JSON.stringify({
                entities: entitySummary,
                contacts: contactsForAI.map(c => ({
                  id: c.id,
                  name: c.name,
                  title: c.title,
                  company: c.company,
                  location: c.location,
                  bio: c.bio?.slice(0, 200),
                  category: c.category,
                  isInvestor: c.is_investor,
                  theses: (c.theses || []).map((t: any) => ({
                    sectors: t.sectors,
                    stages: t.stages,
                  })),
                }))
              })
            }],
            temperature: 0.3,
            max_tokens: 2000,
          }),
        });

        try {
          const openaiResponse = await Promise.race([openaiPromise, timeoutPromise]) as Response;

          if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            console.error('OpenAI API error:', openaiResponse.status, errorText);
            // Don't throw - just skip AI matches
          } else {
            const openaiData = await openaiResponse.json();
            
            if (openaiData.choices?.[0]?.message?.content) {
              let content = openaiData.choices[0].message.content;
              content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
              
              try {
                aiMatches = JSON.parse(content.trim());
                console.log('AI matches parsed:', aiMatches.length);
                
                aiMatches = aiMatches.map((m: any) => {
                  const contact = contacts.find(c => c.id === m.contact_id);
                  return { ...m, contact_name: contact?.name || 'Unknown' };
                });
              } catch (parseError) {
                console.error('Failed to parse AI matches:', parseError);
              }
            }
          }
        } catch (aiError) {
          console.error('AI matching error (non-fatal):', aiError);
          // Continue with name matches only
        }
      }
    }
    
    // Merge matches
    const allMatches = [...nameMatches];
    const nameMatchIds = new Set(nameMatches.map(m => m.contact_id));
    
    for (const aiMatch of aiMatches) {
      if (!nameMatchIds.has(aiMatch.contact_id)) {
        allMatches.push(aiMatch);
      }
    }
    
    console.log('Total matches:', allMatches.length);
    
    if (allMatches.length === 0) {
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Upsert matches
    const matchRecords = allMatches.map((m: any) => ({
      conversation_id: conversationId,
      contact_id: m.contact_id,
      score: m.score,
      reasons: m.reasons,
      justification: m.justification,
      status: 'pending',
    }));
    
    const insertedMatches: any[] = [];
    for (const record of matchRecords) {
      const { data, error } = await supabaseService
        .from('match_suggestions')
        .upsert(record, { 
          onConflict: 'conversation_id,contact_id',
          ignoreDuplicates: false 
        })
        .select(`
          id, conversation_id, contact_id, score, reasons, justification, status, created_at,
          contacts:contact_id ( name )
        `)
        .single();
      
      if (!error && data) {
        insertedMatches.push(data);
      }
    }
    
    console.log('Upserted matches:', insertedMatches.length);
    
    const matchesWithNames = insertedMatches.map((m: any) => ({
      ...m,
      contact_name: m.contacts?.name ?? null
    }));
    
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

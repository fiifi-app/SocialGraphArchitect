import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fuzzy name matching with similarity scoring
function fuzzyNameMatch(mentionedName: string, contactName: string): { match: boolean; score: number; type: string } {
  const mentioned = mentionedName.toLowerCase().trim();
  const contact = contactName.toLowerCase().trim();
  
  // Exact match
  if (mentioned === contact) {
    return { match: true, score: 1.0, type: 'exact' };
  }
  
  // One contains the other (e.g., "Roy Bahat" in "Roy E. Bahat")
  if (contact.includes(mentioned) || mentioned.includes(contact)) {
    return { match: true, score: 0.95, type: 'contains' };
  }
  
  // Split into parts
  const mentionedParts = mentioned.split(/\s+/).filter(p => p.length > 1);
  const contactParts = contact.split(/\s+/).filter(p => p.length > 1);
  
  // Handle single-word names (first name only match)
  if (mentionedParts.length === 1 && contactParts.length >= 1) {
    const singleName = mentionedParts[0];
    const contactFirst = contactParts[0];
    
    // Exact first name match
    if (singleName === contactFirst) {
      return { match: true, score: 0.7, type: 'first-only' };
    }
    
    // Nickname match for first name
    const nicknames: Record<string, string[]> = {
      'matt': ['matthew', 'mat'],
      'matthew': ['matt', 'mat'],
      'rob': ['robert', 'bob', 'bobby'],
      'robert': ['rob', 'bob', 'bobby'],
      'mike': ['michael', 'mick'],
      'michael': ['mike', 'mick'],
    };
    
    if (nicknames[singleName]?.includes(contactFirst) || nicknames[contactFirst]?.includes(singleName)) {
      return { match: true, score: 0.65, type: 'first-nickname' };
    }
    
    return { match: false, score: 0, type: 'none' };
  }
  
  if (mentionedParts.length < 2 || contactParts.length < 1) {
    return { match: false, score: 0, type: 'none' };
  }
  
  const mentionedFirst = mentionedParts[0];
  const mentionedLast = mentionedParts[mentionedParts.length - 1];
  const contactFirst = contactParts[0];
  const contactLast = contactParts[contactParts.length - 1];
  
  // Check for nickname matches (Matt/Matthew, Rob/Robert, etc.)
  const nicknames: Record<string, string[]> = {
    'matt': ['matthew', 'mat'],
    'matthew': ['matt', 'mat'],
    'rob': ['robert', 'bob', 'bobby'],
    'robert': ['rob', 'bob', 'bobby'],
    'bob': ['robert', 'rob', 'bobby'],
    'mike': ['michael', 'mick'],
    'michael': ['mike', 'mick'],
    'jim': ['james', 'jimmy'],
    'james': ['jim', 'jimmy'],
    'bill': ['william', 'will', 'billy'],
    'william': ['bill', 'will', 'billy'],
    'tom': ['thomas', 'tommy'],
    'thomas': ['tom', 'tommy'],
    'joe': ['joseph', 'joey'],
    'joseph': ['joe', 'joey'],
    'dan': ['daniel', 'danny'],
    'daniel': ['dan', 'danny'],
    'chris': ['christopher', 'kristopher'],
    'christopher': ['chris'],
    'alex': ['alexander', 'alexandra'],
    'alexander': ['alex'],
    'sam': ['samuel', 'samantha'],
    'samuel': ['sam'],
    'nick': ['nicholas', 'nicolas'],
    'nicholas': ['nick', 'nicolas'],
    'steve': ['steven', 'stephen'],
    'steven': ['steve', 'stephen'],
    'stephen': ['steve', 'steven'],
    'tony': ['anthony'],
    'anthony': ['tony'],
    'dave': ['david'],
    'david': ['dave'],
    'ed': ['edward', 'eddie'],
    'edward': ['ed', 'eddie'],
    'sara': ['sarah'],
    'sarah': ['sara'],
    'kate': ['katherine', 'catherine', 'kathy'],
    'katherine': ['kate', 'kathy', 'katie'],
    'liz': ['elizabeth', 'beth', 'lizzy'],
    'elizabeth': ['liz', 'beth', 'lizzy'],
    'jen': ['jennifer', 'jenny'],
    'jennifer': ['jen', 'jenny'],
  };
  
  // Check first name match (exact or nickname)
  let firstNameMatch = false;
  if (mentionedFirst === contactFirst) {
    firstNameMatch = true;
  } else if (contactFirst.startsWith(mentionedFirst) || mentionedFirst.startsWith(contactFirst)) {
    firstNameMatch = true;
  } else if (nicknames[mentionedFirst]?.includes(contactFirst) || nicknames[contactFirst]?.includes(mentionedFirst)) {
    firstNameMatch = true;
  }
  
  // Check last name match (exact or close)
  let lastNameMatch = false;
  if (mentionedLast === contactLast) {
    lastNameMatch = true;
  } else if (levenshteinDistance(mentionedLast, contactLast) <= 2) {
    lastNameMatch = true;
  }
  
  // Both first and last match
  if (firstNameMatch && lastNameMatch) {
    return { match: true, score: 0.9, type: 'fuzzy-both' };
  }
  
  // Only last name matches exactly (common for formal references)
  if (mentionedLast === contactLast && mentionedParts.length === 1) {
    return { match: true, score: 0.7, type: 'last-only' };
  }
  
  // Levenshtein distance for close spelling
  const fullDistance = levenshteinDistance(mentioned, contact);
  const maxLen = Math.max(mentioned.length, contact.length);
  const similarity = 1 - (fullDistance / maxLen);
  
  if (similarity >= 0.8) {
    return { match: true, score: similarity, type: 'levenshtein' };
  }
  
  return { match: false, score: 0, type: 'none' };
}

// Levenshtein distance for fuzzy string matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Check if a value matches any item in an array (case-insensitive, partial match)
function matchesAny(value: string, items: string[]): boolean {
  const valueLower = value.toLowerCase();
  return items.some(item => {
    const itemLower = item.toLowerCase();
    return valueLower.includes(itemLower) || itemLower.includes(valueLower);
  });
}

// Parse check size from string (e.g., "$5,000,000" -> 5000000)
function parseCheckSize(value: string): number | null {
  const cleaned = value.replace(/[$,]/g, '').toLowerCase();
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/);
  if (!match) return null;
  
  let num = parseFloat(match[1]);
  const suffix = match[2];
  
  if (suffix === 'k' || suffix === 'thousand') num *= 1000;
  if (suffix === 'm' || suffix === 'million') num *= 1000000;
  
  return num;
}

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
    console.log('=== GENERATE MATCHES START ===');
    console.log('Conversation ID:', conversationId);
    
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
    
    // Get entities
    const { data: entities } = await supabaseService
      .from('conversation_entities')
      .select('*')
      .eq('conversation_id', conversationId);
    
    console.log('=== ENTITIES RECEIVED ===');
    console.log('Total entities:', entities?.length || 0);
    entities?.forEach(e => console.log(`  - ${e.entity_type}: "${e.value}"`));
    
    if (!entities || entities.length === 0) {
      console.log('NO ENTITIES - returning empty matches');
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Also fetch rich context from conversation for better matching
    const { data: conversationContext } = await supabaseService
      .from('conversations')
      .select('target_person, matching_intent, goals_and_needs, domains_and_topics')
      .eq('id', conversationId)
      .single();
    
    console.log('Rich context available:', !!conversationContext?.matching_intent);
    
    // Get contacts with theses and relationship_strength
    const { data: contacts } = await supabaseService
      .from('contacts')
      .select(`
        id, name, first_name, last_name, title, company, location, bio,
        category, contact_type, check_size_min, check_size_max, is_investor,
        relationship_strength, bio_embedding, thesis_embedding,
        theses (id, sectors, stages, check_size_min, check_size_max, geos)
      `)
      .eq('owned_by_profile', user.id);
    
    console.log('=== CONTACTS LOADED ===');
    console.log('Total contacts:', contacts?.length || 0);
    
    if (!contacts || contacts.length === 0) {
      console.log('NO CONTACTS - returning empty matches');
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse entities by type
    const sectors = entities.filter(e => e.entity_type === 'sector').map(e => e.value);
    const stages = entities.filter(e => e.entity_type === 'stage').map(e => e.value);
    const checkSizes = entities.filter(e => e.entity_type === 'check_size').map(e => e.value);
    const geos = entities.filter(e => e.entity_type === 'geo').map(e => e.value);
    const personNames = entities.filter(e => e.entity_type === 'person_name').map(e => e.value);
    
    console.log('=== PARSED ENTITIES ===');
    console.log('Sectors:', sectors);
    console.log('Stages:', stages);
    console.log('Check sizes:', checkSizes);
    console.log('Geos:', geos);
    console.log('Person names:', personNames);
    
    // Parse check size values
    const parsedCheckSizes = checkSizes.map(cs => parseCheckSize(cs)).filter(v => v !== null) as number[];
    const minCheckSize = parsedCheckSizes.length > 0 ? Math.min(...parsedCheckSizes) : null;
    const maxCheckSize = parsedCheckSizes.length > 0 ? Math.max(...parsedCheckSizes) : null;
    console.log('Parsed check size range:', minCheckSize, '-', maxCheckSize);

    // Weighted scoring formula:
    // score = 0.5 * semantic_similarity + 0.2 * tag_overlap + 0.1 * role_match + 0.1 * geo_match + 0.1 * relationship_strength
    const WEIGHTS = {
      semantic: 0.5,
      tagOverlap: 0.2,
      roleMatch: 0.1,
      geoMatch: 0.1,
      relationship: 0.1,
    };
    
    // Helper: Jaccard similarity for tag overlap
    function jaccardSimilarity(set1: string[], set2: string[]): number {
      if (set1.length === 0 && set2.length === 0) return 0;
      const s1 = new Set(set1.map(s => s.toLowerCase()));
      const s2 = new Set(set2.map(s => s.toLowerCase()));
      const intersection = [...s1].filter(x => s2.has(x)).length;
      const union = new Set([...s1, ...s2]).size;
      return union > 0 ? intersection / union : 0;
    }
    
    // Helper: Check role/title match for hiring needs
    function roleMatchScore(contactTitle: string | null, neededRoles: string[]): number {
      if (!contactTitle || neededRoles.length === 0) return 0;
      const titleLower = contactTitle.toLowerCase();
      for (const role of neededRoles) {
        if (titleLower.includes(role.toLowerCase())) return 1;
      }
      return 0;
    }
    
    // Extract what kind of contacts to find from matching_intent
    const whatToFind = conversationContext?.matching_intent?.what_kind_of_contacts_to_find || [];
    const hiringRoles = conversationContext?.goals_and_needs?.hiring?.roles_needed || [];
    const investorTypes = conversationContext?.goals_and_needs?.fundraising?.investor_types || [];
    
    console.log('What to find:', whatToFind);
    console.log('Hiring roles:', hiringRoles);
    console.log('Investor types:', investorTypes);
    
    // Build search tags from conversation context
    const conversationTags: string[] = [
      ...sectors,
      ...stages,
      ...geos,
      ...(conversationContext?.domains_and_topics?.product_keywords || []),
      ...(conversationContext?.domains_and_topics?.technology_keywords || []),
    ];
    
    // Score each contact
    interface Match {
      contact_id: string;
      contact_name: string;
      score: number;
      rawScore: number; // 0-1 normalized score
      reasons: string[];
      justification: string;
      matchDetails: {
        semanticScore: number;
        tagOverlapScore: number;
        roleMatchScore: number;
        geoMatchScore: number;
        relationshipScore: number;
        nameMatch: boolean;
        nameMatchScore: number;
        nameMatchType: string;
      };
    }
    
    const matches: Match[] = [];
    
    console.log('=== SCORING CONTACTS (Weighted Formula) ===');
    
    for (const contact of contacts) {
      const reasons: string[] = [];
      const matchDetails = {
        semanticScore: 0,
        tagOverlapScore: 0,
        roleMatchScore: 0,
        geoMatchScore: 0,
        relationshipScore: 0,
        nameMatch: false,
        nameMatchScore: 0,
        nameMatchType: 'none',
      };
      
      // Build contact tags from theses and profile
      const contactTags: string[] = [];
      const theses = contact.theses || [];
      
      for (const thesis of theses) {
        contactTags.push(...(thesis.sectors || []));
        contactTags.push(...(thesis.stages || []));
        contactTags.push(...(thesis.geos || []));
      }
      
      // Add contact type tags
      if (contact.contact_type) {
        contactTags.push(...contact.contact_type);
      }
      if (contact.is_investor) {
        contactTags.push('investor');
      }
      
      // 1. SEMANTIC SIMILARITY (50% weight)
      // For now, use 0 if embeddings not available (Phase 3 will add embedding matching)
      // TODO: Implement pgvector similarity when embeddings are populated
      matchDetails.semanticScore = 0;
      
      // 2. TAG OVERLAP (20% weight) - Jaccard similarity
      matchDetails.tagOverlapScore = jaccardSimilarity(conversationTags, contactTags);
      if (matchDetails.tagOverlapScore > 0.1) {
        const matchedTags = conversationTags.filter(t => 
          contactTags.some(ct => ct.toLowerCase().includes(t.toLowerCase()))
        );
        if (matchedTags.length > 0) {
          reasons.push(`Matches: ${matchedTags.slice(0, 3).join(', ')}`);
        }
      }
      
      // 3. ROLE MATCH (10% weight) - Check if contact's role fits needs
      matchDetails.roleMatchScore = roleMatchScore(contact.title, hiringRoles);
      
      // Also check if contact type matches investor types needed
      if (investorTypes.length > 0 && contact.contact_type) {
        for (const iType of investorTypes) {
          const iTypeLower = iType.toLowerCase();
          for (const cType of contact.contact_type) {
            if (cType.toLowerCase().includes(iTypeLower) || iTypeLower.includes(cType.toLowerCase())) {
              matchDetails.roleMatchScore = Math.max(matchDetails.roleMatchScore, 0.8);
              reasons.push(`${cType} investor`);
              break;
            }
          }
        }
      }
      
      // 4. GEO MATCH (10% weight)
      if (geos.length > 0 && contact.location) {
        for (const geo of geos) {
          if (matchesAny(geo, [contact.location])) {
            matchDetails.geoMatchScore = 1;
            reasons.push(`Location: ${contact.location}`);
            break;
          }
        }
      }
      
      // 5. RELATIONSHIP STRENGTH (10% weight) - Normalized 0-1
      const relStrength = contact.relationship_strength ?? 50;
      matchDetails.relationshipScore = relStrength / 100;
      
      // NAME MATCH - Major boost for explicit mentions
      const namesToCheck: string[] = [];
      if (contact.name) namesToCheck.push(contact.name);
      if (contact.first_name && contact.last_name) {
        namesToCheck.push(`${contact.first_name} ${contact.last_name}`);
      }
      
      if (personNames.length > 0 && namesToCheck.length > 0) {
        for (const personName of personNames) {
          for (const contactNameToCheck of namesToCheck) {
            const nameResult = fuzzyNameMatch(personName, contactNameToCheck);
            if (nameResult.match && nameResult.score > matchDetails.nameMatchScore) {
              matchDetails.nameMatch = true;
              matchDetails.nameMatchScore = nameResult.score;
              matchDetails.nameMatchType = nameResult.type;
              console.log(`  Name match found: "${personName}" ~ "${contactNameToCheck}" (${nameResult.type}, ${Math.round(nameResult.score * 100)}%)`);
            }
          }
        }
      }
      
      // CALCULATE WEIGHTED SCORE (0-1 range)
      let rawScore = 
        WEIGHTS.semantic * matchDetails.semanticScore +
        WEIGHTS.tagOverlap * matchDetails.tagOverlapScore +
        WEIGHTS.roleMatch * matchDetails.roleMatchScore +
        WEIGHTS.geoMatch * matchDetails.geoMatchScore +
        WEIGHTS.relationship * matchDetails.relationshipScore;
      
      // NAME MATCH BOOST - Add 0.3 to raw score for name mentions
      if (matchDetails.nameMatch) {
        rawScore += 0.3 * matchDetails.nameMatchScore;
        if (matchDetails.nameMatchScore >= 0.95) {
          reasons.unshift(`Name mentioned: "${contact.name}"`);
        } else {
          reasons.unshift(`Similar name: "${contact.name}" (${Math.round(matchDetails.nameMatchScore * 100)}%)`);
        }
      }
      
      // Clamp raw score to 0-1
      rawScore = Math.min(Math.max(rawScore, 0), 1);
      
      // MAP TO 3-STAR RATING
      // Thresholds: 0.15 = 1 star, 0.35 = 2 stars, 0.55 = 3 stars
      let starScore = 0;
      if (rawScore >= 0.55) {
        starScore = 3;
      } else if (rawScore >= 0.35) {
        starScore = 2;
      } else if (rawScore >= 0.15) {
        starScore = 1;
      }
      
      // Only include if score >= 1 star
      if (starScore >= 1) {
        const justification = reasons.length > 0 
          ? `${contact.name}: ${reasons.join('; ')}`
          : `${contact.name} is a potential match.`;
        
        matches.push({
          contact_id: contact.id,
          contact_name: contact.name,
          score: starScore,
          rawScore,
          reasons,
          justification,
          matchDetails,
        });
        
        console.log(`MATCH: ${contact.name} (${starScore}★, raw: ${rawScore.toFixed(3)})`);
      }
    }
    
    // Sort by star score (highest first), then by raw score for finer ranking
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.rawScore - a.rawScore;
    });
    
    // Take top 20 matches
    const topMatches = matches.slice(0, 20);
    
    console.log('=== MATCHING COMPLETE ===');
    console.log('Total matches found:', matches.length);
    console.log('Returning top:', topMatches.length);
    topMatches.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.contact_name} (score: ${m.score}, name: ${m.matchDetails.nameMatch ? 'YES' : 'NO'})`);
    });
    
    if (topMatches.length === 0) {
      console.log('NO MATCHES met minimum score threshold');
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Upsert matches to database
    const insertedMatches: any[] = [];
    for (const match of topMatches) {
      const { data, error } = await supabaseService
        .from('match_suggestions')
        .upsert({
          conversation_id: conversationId,
          contact_id: match.contact_id,
          score: match.score,
          reasons: match.reasons,
          justification: match.justification,
          status: 'pending',
        }, { 
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
      } else if (error) {
        console.error('Error upserting match:', error);
      }
    }
    
    console.log('=== DATABASE UPSERT ===');
    console.log('Matches saved:', insertedMatches.length);
    
    const matchesWithNames = insertedMatches.map((m: any) => ({
      ...m,
      contact_name: m.contacts?.name ?? null
    }));
    
    console.log('=== GENERATE MATCHES END ===');
    
    return new Response(
      JSON.stringify({ matches: matchesWithNames }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('=== GENERATE MATCHES ERROR ===');
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

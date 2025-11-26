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
    
    // Get contacts with theses
    const { data: contacts } = await supabaseService
      .from('contacts')
      .select(`
        id, name, first_name, last_name, title, company, location, bio,
        category, contact_type, check_size_min, check_size_max, is_investor,
        theses (id, sectors, stages, check_size_min, check_size_max)
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

    // Score each contact
    interface Match {
      contact_id: string;
      contact_name: string;
      score: number;
      reasons: string[];
      justification: string;
      matchDetails: {
        sectorMatch: boolean;
        stageMatch: boolean;
        checkSizeMatch: boolean;
        nameMatch: boolean;
        nameMatchScore: number;
        nameMatchType: string;
        geoMatch: boolean;
      };
    }
    
    const matches: Match[] = [];
    
    console.log('=== SCORING CONTACTS ===');
    
    for (const contact of contacts) {
      let score = 0;
      const reasons: string[] = [];
      const matchDetails = {
        sectorMatch: false,
        stageMatch: false,
        checkSizeMatch: false,
        nameMatch: false,
        nameMatchScore: 0,
        nameMatchType: 'none',
        geoMatch: false,
      };
      
      // Check thesis matches (PRIMARY CRITERIA)
      const theses = contact.theses || [];
      
      for (const thesis of theses) {
        const thesisSectors = thesis.sectors || [];
        const thesisStages = thesis.stages || [];
        
        // Sector match
        if (sectors.length > 0 && thesisSectors.length > 0) {
          for (const sector of sectors) {
            if (matchesAny(sector, thesisSectors)) {
              matchDetails.sectorMatch = true;
              break;
            }
          }
        }
        
        // Stage match
        if (stages.length > 0 && thesisStages.length > 0) {
          for (const stage of stages) {
            if (matchesAny(stage, thesisStages)) {
              matchDetails.stageMatch = true;
              break;
            }
          }
        }
        
        // Check size match
        if (minCheckSize !== null && thesis.check_size_min !== null && thesis.check_size_max !== null) {
          if (minCheckSize >= thesis.check_size_min && minCheckSize <= thesis.check_size_max) {
            matchDetails.checkSizeMatch = true;
          }
        }
      }
      
      // Also check contact-level check size
      if (!matchDetails.checkSizeMatch && minCheckSize !== null) {
        if (contact.check_size_min !== null && contact.check_size_max !== null) {
          if (minCheckSize >= contact.check_size_min && minCheckSize <= contact.check_size_max) {
            matchDetails.checkSizeMatch = true;
          }
        }
      }
      
      // Name match (SECONDARY but boosts score)
      if (personNames.length > 0 && contact.name) {
        for (const personName of personNames) {
          const nameResult = fuzzyNameMatch(personName, contact.name);
          if (nameResult.match && nameResult.score > matchDetails.nameMatchScore) {
            matchDetails.nameMatch = true;
            matchDetails.nameMatchScore = nameResult.score;
            matchDetails.nameMatchType = nameResult.type;
          }
        }
      }
      
      // Geo match (SECONDARY)
      if (geos.length > 0 && contact.location) {
        for (const geo of geos) {
          if (matchesAny(geo, [contact.location])) {
            matchDetails.geoMatch = true;
            break;
          }
        }
      }
      
      // Calculate score based on PRIMARY criteria
      // Sector + Stage + CheckSize are primary
      let primaryMatches = 0;
      if (matchDetails.sectorMatch) {
        primaryMatches++;
        reasons.push(`Sector match: invests in ${sectors.join(', ')}`);
      }
      if (matchDetails.stageMatch) {
        primaryMatches++;
        reasons.push(`Stage match: focuses on ${stages.join(', ')}`);
      }
      if (matchDetails.checkSizeMatch) {
        primaryMatches++;
        reasons.push(`Check size match: ${checkSizes.join(', ')}`);
      }
      
      // Base score from primary matches
      if (primaryMatches >= 2) {
        score = 2; // Good match with 2+ primary criteria
      } else if (primaryMatches >= 1) {
        score = 1; // Weak match with 1 primary criterion
      }
      
      // Name match BOOSTS the score significantly
      if (matchDetails.nameMatch) {
        score += 1; // Boost by 1 for name match
        if (matchDetails.nameMatchScore >= 0.95) {
          reasons.unshift(`Name mentioned: "${contact.name}" (${matchDetails.nameMatchType})`);
        } else {
          reasons.unshift(`Similar name: "${contact.name}" (${matchDetails.nameMatchType}, ${Math.round(matchDetails.nameMatchScore * 100)}% match)`);
        }
      }
      
      // Geo match as secondary bonus
      if (matchDetails.geoMatch) {
        if (score > 0) score = Math.min(score + 0.5, 3);
        reasons.push(`Location match: ${geos.join(', ')}`);
      }
      
      // Cap at 3 stars
      score = Math.min(Math.round(score), 3);
      
      // Only include if score >= 1
      if (score >= 1) {
        const justification = reasons.length > 0 
          ? `${contact.name} matches: ${reasons.join('; ')}`
          : `${contact.name} is a potential match based on profile.`;
        
        matches.push({
          contact_id: contact.id,
          contact_name: contact.name,
          score,
          reasons,
          justification,
          matchDetails,
        });
        
        console.log(`MATCH: ${contact.name} (score: ${score})`);
        console.log(`   Details:`, matchDetails);
      }
    }
    
    // Sort by score (highest first), then by name match score
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.matchDetails.nameMatchScore - a.matchDetails.nameMatchScore;
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

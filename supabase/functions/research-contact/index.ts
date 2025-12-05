import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Contact type detection patterns
const CONTACT_TYPE_PATTERNS: Record<string, RegExp[]> = {
  'GP': [
    /\bgeneral partner\b/i,
    /\bmanaging partner\b/i,
    /\bventure partner\b/i,
    /\bpartner at .*(capital|ventures|partners|vc)\b/i,
    /\b(vc|venture capital)\s*(partner|gp)\b/i,
  ],
  'LP': [
    /\blimited partner\b/i,
    /\blp\b.*\b(fund|investor|allocation)\b/i,
    /\binstitutional investor\b/i,
    /\bendowment\b/i,
    /\bpension fund\b/i,
  ],
  'Angel': [
    /\bangel investor\b/i,
    /\bangel\b.*\binvest/i,
    /\bindividual investor\b/i,
    /\bsuper angel\b/i,
  ],
  'Family Office': [
    /\bfamily office\b/i,
    /\bsingle family office\b/i,
    /\bmulti.?family office\b/i,
    /\bprivate wealth\b/i,
  ],
  'Startup': [
    /\bfounder\b/i,
    /\bco-?founder\b/i,
    /\bceo\b.*\b(startup|early.?stage)\b/i,
    /\bstartup founder\b/i,
    /\bentrepreneur\b/i,
  ],
  'PE': [
    /\bprivate equity\b/i,
    /\bpe fund\b/i,
    /\bgrowth equity\b/i,
    /\bbuyout\b/i,
    /\bturnaround\b/i,
  ],
};

// Detect contact type from title and bio text
function detectContactTypes(title: string | null, bio: string | null, existingTypes: string[] | null): string[] {
  const combinedText = `${title || ''} ${bio || ''}`.toLowerCase();
  const detectedTypes = new Set<string>(existingTypes || []);
  
  for (const [type, patterns] of Object.entries(CONTACT_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(combinedText)) {
        detectedTypes.add(type);
        break;
      }
    }
  }
  
  return Array.from(detectedTypes);
}

// Use OpenAI Responses API with web_search tool for real data
async function searchWithWebSearch(openaiApiKey: string, query: string, systemPrompt: string): Promise<any> {
  // Use the Responses API with proper message structure
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      tools: [{ type: 'web_search' }],
      tool_choice: 'auto',
      input: [
        {
          role: 'system',
          content: [{ type: 'text', text: systemPrompt }]
        },
        {
          role: 'user', 
          content: [{ type: 'text', text: query }]
        }
      ]
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI Responses API error:', response.status, errorText);
    return null;
  }

  const data = await response.json();
  console.log('Responses API raw result:', JSON.stringify(data).substring(0, 500));
  
  // Extract text output from the completed response
  // The Responses API returns output array with message content after tool execution
  if (data.output && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const contentItem of item.content) {
          if (contentItem.type === 'output_text' || contentItem.type === 'text') {
            return contentItem.text;
          }
        }
      }
    }
  }
  
  // Fallback: check for direct output_text
  if (data.output_text) {
    return data.output_text;
  }
  
  console.log('Could not find text output in response');
  return null;
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

    const { contactId } = await req.json();
    console.log('=== RESEARCH CONTACT START ===');
    console.log('Contact ID:', contactId);
    
    // Get contact data
    const { data: contact, error: contactError } = await supabaseService
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('owned_by_profile', user.id)
      .single();

    if (contactError || !contact) {
      throw new Error('Contact not found or access denied');
    }

    console.log('Contact:', contact.name);
    console.log('Company URL:', contact.company_url);
    console.log('Company:', contact.company);
    
    // Check if we have enough data to research
    if (!contact.name) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Contact needs a name to research' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Determine if this is an investor contact
    const investorTypes = ['GP', 'Angel', 'Family Office', 'PE', 'VC'];
    const isInvestor = contact.contact_type?.some((t: string) => investorTypes.includes(t)) || 
                       contact.is_investor === true;

    let bioResult = null;
    let thesisResult = null;
    
    // Step 1: Research person's bio using web search if missing bio or title
    if (!contact.bio || !contact.title || contact.bio?.length < 50) {
      console.log('Researching bio for:', contact.name);
      
      const searchQuery = [
        contact.name,
        contact.company,
        contact.company_url ? `site:${contact.company_url}` : '',
        'professional bio background'
      ].filter(Boolean).join(' ');
      
      const systemPrompt = `Search the web for professional information about this person. 
Return ONLY a valid JSON object with exactly these fields:
{
  "title": "Their current job title/role",
  "bio": "A 2-3 sentence professional bio based on real web search results",
  "company": "Their current company name",
  "found": true or false
}
Only set found:true if you found REAL information from web search. If unsure, set found:false.`;

      const webSearchResult = await searchWithWebSearch(openaiApiKey, searchQuery, systemPrompt);
      
      if (webSearchResult) {
        try {
          // Try to extract JSON from the response
          const jsonMatch = webSearchResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            bioResult = JSON.parse(jsonMatch[0]);
            console.log('Bio research result:', bioResult);
          }
        } catch (e) {
          console.error('Failed to parse bio response:', e);
        }
      }
    }
    
    // Step 2: Research investment thesis if this is an investor and missing investor_notes
    if (isInvestor && (!contact.investor_notes || contact.investor_notes.length < 50)) {
      console.log('Researching investment thesis for:', contact.name);
      
      const thesisQuery = [
        contact.name,
        contact.company,
        contact.company_url ? `site:${contact.company_url}` : '',
        'investment thesis focus areas portfolio stages check size'
      ].filter(Boolean).join(' ');
      
      const systemPrompt = `Search the web for investment thesis information about this investor/fund.
Return ONLY a valid JSON object with exactly these fields:
{
  "thesis_summary": "2-3 sentence summary of their investment focus based on web search",
  "sectors": ["sector1", "sector2"],
  "stages": ["Seed", "Series A"],
  "check_sizes": ["$500K-2M"],
  "geographic_focus": ["US", "Europe"],
  "found": true or false
}
Only set found:true if you found REAL thesis information from web search. If unsure, set found:false.`;

      const webSearchResult = await searchWithWebSearch(openaiApiKey, thesisQuery, systemPrompt);
      
      if (webSearchResult) {
        try {
          const jsonMatch = webSearchResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            thesisResult = JSON.parse(jsonMatch[0]);
            console.log('Thesis research result:', thesisResult);
          }
        } catch (e) {
          console.error('Failed to parse thesis response:', e);
        }
      }
    }
    
    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    if (bioResult?.found) {
      if (bioResult.title && (!contact.title || contact.title.length < 5)) {
        updates.title = bioResult.title;
      }
      if (bioResult.bio && (!contact.bio || contact.bio.length < 50)) {
        updates.bio = bioResult.bio;
      }
      if (bioResult.company && !contact.company) {
        updates.company = bioResult.company;
      }
    }
    
    // Auto-detect contact types from title and bio
    const newTitle = updates.title || contact.title;
    const newBio = updates.bio || contact.bio;
    const detectedTypes = detectContactTypes(newTitle, newBio, contact.contact_type);
    
    // Update contact_type if new types were detected
    if (detectedTypes.length > 0) {
      const existingTypes = contact.contact_type || [];
      const hasNewTypes = detectedTypes.some(t => !existingTypes.includes(t));
      
      if (hasNewTypes) {
        updates.contact_type = detectedTypes;
        console.log('Auto-detected contact types:', detectedTypes);
        
        // Also set is_investor if any investor type is detected
        const investorTypes = ['GP', 'LP', 'Angel', 'Family Office', 'PE'];
        if (detectedTypes.some(t => investorTypes.includes(t)) && !contact.is_investor) {
          updates.is_investor = true;
        }
      }
    }
    
    if (thesisResult?.found && thesisResult.thesis_summary) {
      // Build investor notes from thesis research
      const noteParts = [thesisResult.thesis_summary];
      
      if (thesisResult.sectors?.length > 0) {
        noteParts.push(`Sectors: ${thesisResult.sectors.join(', ')}`);
      }
      if (thesisResult.stages?.length > 0) {
        noteParts.push(`Stages: ${thesisResult.stages.join(', ')}`);
      }
      if (thesisResult.check_sizes?.length > 0) {
        noteParts.push(`Check sizes: ${thesisResult.check_sizes.join(', ')}`);
      }
      if (thesisResult.geographic_focus?.length > 0) {
        noteParts.push(`Geographic focus: ${thesisResult.geographic_focus.join(', ')}`);
      }
      
      const investorNotes = noteParts.join('\n');
      
      if (!contact.investor_notes || contact.investor_notes.length < 50) {
        updates.investor_notes = investorNotes;
      } else {
        // Append to existing notes
        updates.investor_notes = contact.investor_notes + '\n\n--- AI Research ---\n' + investorNotes;
      }
    }
    
    // Apply updates if we found anything
    const hasUpdates = Object.keys(updates).length > 1; // More than just updated_at
    
    if (hasUpdates) {
      const { error: updateError } = await supabaseService
        .from('contacts')
        .update(updates)
        .eq('id', contactId);
      
      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }
      
      console.log('Contact updated with:', Object.keys(updates));
    }
    
    console.log('=== RESEARCH CONTACT END ===');
    
    return new Response(
      JSON.stringify({ 
        success: true,
        updated: hasUpdates,
        fields: Object.keys(updates).filter(k => k !== 'updated_at'),
        bioFound: bioResult?.found || false,
        thesisFound: thesisResult?.found || false,
        detectedTypes: updates.contact_type || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('=== RESEARCH CONTACT ERROR ===');
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

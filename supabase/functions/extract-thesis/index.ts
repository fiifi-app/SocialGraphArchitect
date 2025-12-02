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

    const { contactId } = await req.json();
    console.log('=== EXTRACT THESIS START ===');
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
    console.log('Bio:', contact.bio?.substring(0, 100));
    console.log('Investor notes:', contact.investor_notes?.substring(0, 100));
    console.log('Title:', contact.title);
    console.log('Company:', contact.company);
    console.log('Category:', contact.category);
    
    // Build text to analyze
    const textParts = [
      contact.bio || '',
      contact.investor_notes || '',
      contact.title || '',
      contact.company || '',
      contact.category || '',
      contact.location || '',
    ].filter(Boolean);
    
    const textToAnalyze = textParts.join('\n');
    
    if (!textToAnalyze.trim()) {
      console.log('No text to analyze for thesis extraction');
      return new Response(
        JSON.stringify({ 
          thesis: null, 
          message: 'No data available to extract thesis' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Text to analyze:', textToAnalyze.substring(0, 300));
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Call OpenAI to extract thesis keywords
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: `You are an expert at analyzing VC/investor profiles to extract investment thesis keywords.

EXTRACT THE FOLLOWING CATEGORIES:

1. "sectors" - Industry sectors they invest in or work in:
   Examples: "B2B SaaS", "FinTech", "HealthTech", "AI/ML", "EdTech", "CleanTech", "Cybersecurity", "Enterprise", "Consumer", "Marketplace", "Developer Tools", "Infrastructure"

2. "stages" - Investment/company stages:
   Examples: "Pre-seed", "Seed", "Series A", "Series B", "Growth", "Late Stage", "Early Stage"

3. "geos" - Geographic focus areas:
   Examples: "San Francisco", "New York", "Silicon Valley", "Europe", "Asia", "Global", "US", "NYC", "LA"

4. "check_sizes" - Investment check sizes mentioned:
   Examples: "$500K", "$1M-5M", "$10M+", "Series A checks"

5. "keywords" - Other relevant investment keywords:
   Examples: "founder-friendly", "technical founders", "first check", "lead investor", "follow-on", "B2B", "enterprise sales"

RULES:
- Extract actual values mentioned or strongly implied in the text
- Normalize to standard industry terminology
- Return empty array [] if nothing found for a category
- Max 5 items per category, prioritize most relevant

Return JSON:
{
  "sectors": ["sector1", "sector2"],
  "stages": ["stage1"],
  "geos": ["geo1"],
  "check_sizes": ["size1"],
  "keywords": ["keyword1", "keyword2"],
  "summary": "One sentence investment thesis summary"
}`
        }, {
          role: 'user',
          content: `Extract investment thesis keywords from this profile:\n\n${textToAnalyze}`
        }],
        temperature: 0.2,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API failed: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    console.log('OpenAI response received');
    
    let content = openaiData.choices[0].message.content;
    console.log('Raw content:', content);
    
    // Parse JSON response
    let thesis;
    try {
      thesis = JSON.parse(content.trim());
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      throw new Error('Failed to parse AI response');
    }
    
    console.log('=== EXTRACTED THESIS ===');
    console.log('Sectors:', thesis.sectors);
    console.log('Stages:', thesis.stages);
    console.log('Geos:', thesis.geos);
    console.log('Check sizes:', thesis.check_sizes);
    console.log('Keywords:', thesis.keywords);
    console.log('Summary:', thesis.summary);
    
    // Check if thesis exists for this contact
    const { data: existingThesis } = await supabaseService
      .from('theses')
      .select('id')
      .eq('contact_id', contactId)
      .single();
    
    // Upsert thesis data - store all extracted fields including keywords
    const thesisData = {
      contact_id: contactId,
      sectors: thesis.sectors || [],
      stages: thesis.stages || [],
      geos: thesis.geos || [],
      check_sizes: thesis.check_sizes || [],
      personas: thesis.keywords || [], // Store keywords in personas field
      intents: [], // Reserved for future use
      notes: thesis.summary || null,
      updated_at: new Date().toISOString(),
    };
    
    let savedThesis;
    if (existingThesis) {
      // Update existing thesis
      const { data, error } = await supabaseService
        .from('theses')
        .update(thesisData)
        .eq('id', existingThesis.id)
        .select()
        .single();
      
      if (error) {
        console.error('Update thesis error:', error);
        throw error;
      }
      savedThesis = data;
      console.log('Updated existing thesis:', existingThesis.id);
    } else {
      // Insert new thesis
      const { data, error } = await supabaseService
        .from('theses')
        .insert(thesisData)
        .select()
        .single();
      
      if (error) {
        console.error('Insert thesis error:', error);
        throw error;
      }
      savedThesis = data;
      console.log('Created new thesis:', data.id);
    }
    
    console.log('=== EXTRACT THESIS END ===');
    
    return new Response(
      JSON.stringify({ 
        thesis: savedThesis,
        extracted: {
          sectors: thesis.sectors,
          stages: thesis.stages,
          geos: thesis.geos,
          check_sizes: thesis.check_sizes,
          keywords: thesis.keywords,
          summary: thesis.summary,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('=== EXTRACT THESIS ERROR ===');
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

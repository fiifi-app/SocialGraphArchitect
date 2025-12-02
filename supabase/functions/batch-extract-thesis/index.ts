import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Contact {
  id: string;
  name: string;
  bio: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  investor_notes: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const action = body.action || 'process';
    const batchSize = Math.min(body.batchSize || 25, 50); // Max 50 per call to avoid timeout
    
    // Action: check - return current status
    if (action === 'check') {
      // Get counts
      const [contactsResult, thesesResult] = await Promise.all([
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .or('bio.not.is.null,title.not.is.null,investor_notes.not.is.null'),
        supabase
          .from('theses')
          .select('id', { count: 'exact', head: true })
      ]);
      
      const eligibleCount = contactsResult.count || 0;
      const extractedCount = thesesResult.count || 0;
      const pendingCount = Math.max(0, eligibleCount - extractedCount);
      
      return new Response(
        JSON.stringify({
          eligible: eligibleCount,
          extracted: extractedCount,
          pending: pendingCount,
          batchSize
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Action: process - extract thesis for a batch of contacts
    // Get contact IDs that already have thesis records
    const { data: existingTheses } = await supabase
      .from('theses')
      .select('contact_id');
    
    const existingContactIds = new Set((existingTheses || []).map(t => t.contact_id));
    
    // Get contacts that need extraction
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, bio, title, company, location, investor_notes')
      .or('bio.not.is.null,title.not.is.null,investor_notes.not.is.null')
      .limit(batchSize * 2); // Fetch more to filter
    
    if (contactsError) throw contactsError;
    
    // Filter to contacts without thesis
    const contactsToProcess = (contacts || [])
      .filter((c: Contact) => !existingContactIds.has(c.id))
      .slice(0, batchSize);
    
    if (contactsToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'All eligible contacts already have thesis data',
          processed: 0,
          succeeded: 0,
          failed: 0,
          remaining: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${contactsToProcess.length} contacts for thesis extraction`);
    
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Process contacts in parallel (5 at a time to avoid rate limits)
    const PARALLEL_SIZE = 5;
    for (let i = 0; i < contactsToProcess.length; i += PARALLEL_SIZE) {
      const batch = contactsToProcess.slice(i, i + PARALLEL_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(async (contact: Contact) => {
          try {
            const thesis = await extractThesisForContact(contact, openaiKey);
            
            // Save to database
            const { error: insertError } = await supabase
              .from('theses')
              .upsert({
                contact_id: contact.id,
                sectors: thesis.sectors || [],
                stages: thesis.stages || [],
                check_sizes: thesis.check_sizes || [],
                geos: thesis.geos || [],
                personas: thesis.keywords || [],
                intents: [],
                notes: thesis.summary || '',
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'contact_id'
              });
            
            if (insertError) throw insertError;
            return { success: true, name: contact.name };
          } catch (error: any) {
            console.error(`Failed for ${contact.name}:`, error.message);
            return { success: false, name: contact.name, error: error.message };
          }
        })
      );
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          succeeded++;
        } else {
          failed++;
          if (result.status === 'fulfilled' && result.value.error) {
            errors.push(`${result.value.name}: ${result.value.error}`);
          }
        }
      });
      
      // Small delay between batches
      if (i + PARALLEL_SIZE < contactsToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Get updated remaining count
    const { count: remainingCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .or('bio.not.is.null,title.not.is.null,investor_notes.not.is.null')
      .not('id', 'in', `(${[...existingContactIds, ...contactsToProcess.map(c => c.id)].join(',')})`);
    
    return new Response(
      JSON.stringify({
        processed: contactsToProcess.length,
        succeeded,
        failed,
        remaining: remainingCount || 0,
        errors: errors.slice(0, 5) // Only return first 5 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Batch extraction error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Batch extraction failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractThesisForContact(contact: Contact, openaiKey: string) {
  const profileText = [
    contact.name ? `Name: ${contact.name}` : '',
    contact.title ? `Title: ${contact.title}` : '',
    contact.company ? `Company: ${contact.company}` : '',
    contact.location ? `Location: ${contact.location}` : '',
    contact.bio ? `Bio: ${contact.bio}` : '',
    contact.investor_notes ? `Investor Notes: ${contact.investor_notes}` : '',
  ].filter(Boolean).join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing investor and professional profiles to extract investment thesis information.
Extract the following from the profile:
- sectors: Investment sectors/industries of interest (e.g., FinTech, HealthTech, SaaS, Consumer, Enterprise)
- stages: Investment stages (e.g., Pre-Seed, Seed, Series A, Series B, Growth)
- check_sizes: Investment check sizes if mentioned (e.g., "$100K-$500K", "$1M-$5M")
- geos: Geographic focus areas (e.g., "San Francisco Bay Area", "New York", "Southeast Asia")
- keywords: Other relevant keywords about their focus or expertise

Return a JSON object with these fields. Use empty arrays if information is not available.
Also include a brief "summary" field describing their investment focus.`
        },
        {
          role: 'user',
          content: profileText
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  return JSON.parse(content);
}

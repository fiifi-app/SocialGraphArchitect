import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentRequest {
  contactId: string;
  provider?: 'hunter' | 'pdl' | 'auto';
  data?: {
    name?: string;
    email?: string;
    company?: string;
    linkedinUrl?: string;
  };
}

interface HunterEmailFinderResponse {
  data: {
    email: string | null;
    first_name: string;
    last_name: string;
    position: string | null;
    linkedin: string | null;
    twitter: string | null;
    company: string;
    confidence: number;
  };
}

interface HunterDomainResponse {
  data: {
    domain: string;
    organization: string;
    emails: Array<{
      value: string;
      type: string;
      confidence: number;
      first_name: string;
      last_name: string;
      position: string;
      linkedin: string | null;
    }>;
  };
}

interface PDLResponse {
  data: {
    full_name: string;
    first_name: string;
    last_name: string;
    linkedin_url: string;
    summary: string; // LinkedIn "About" section
    current_job: {
      company: {
        name: string;
        website: string;
        industry: string;
        size: string;
      };
      title: string;
    }[];
    emails: Array<{
      address: string;
      type: string;
    }>;
  };
}

async function enrichWithHunter(data: any, apiKey: string) {
  console.log('Enriching with Hunter.io:', { name: data.name, email: data.email });
  
  // Extract domain from email if available, otherwise skip Hunter (needs domain, not company name)
  let domain = null;
  if (data.email) {
    domain = data.email.split('@')[1];
  }
  
  if (!domain) {
    console.log('Hunter.io: No email domain available, skipping');
    return null;
  }
  
  // Try Email Finder if we have name and domain
  if (data.name) {
    const [firstName, ...lastNameParts] = data.name.split(' ');
    const lastName = lastNameParts.join(' ');
    
    const url = new URL('https://api.hunter.io/v2/email-finder');
    url.searchParams.set('domain', domain);
    url.searchParams.set('first_name', firstName);
    if (lastName) url.searchParams.set('last_name', lastName);
    url.searchParams.set('api_key', apiKey);
    
    try {
      const response = await fetch(url.toString());
      const result: HunterEmailFinderResponse = await response.json();
      
      if (result.data && result.data.email) {
        return {
          email: result.data.email,
          linkedinUrl: result.data.linkedin || data.linkedinUrl,
          title: result.data.position || data.title,
          confidence: result.data.confidence,
          source: 'hunter',
        };
      }
    } catch (error) {
      console.error('Hunter Email Finder error:', error);
    }
  }
  
  // Try Domain Search
  const url = new URL('https://api.hunter.io/v2/domain-search');
  url.searchParams.set('domain', domain);
  url.searchParams.set('api_key', apiKey);
  
  try {
    const response = await fetch(url.toString());
    const result: HunterDomainResponse = await response.json();
    
    if (result.data && result.data.emails && result.data.emails.length > 0) {
      // Find best match based on name
      let bestMatch = result.data.emails[0];
      
      if (data.name) {
        const nameLower = data.name.toLowerCase();
        const match = result.data.emails.find(e => {
          const fullName = `${e.first_name} ${e.last_name}`.toLowerCase();
          return fullName === nameLower;
        });
        if (match) bestMatch = match;
      }
      
      return {
        email: bestMatch.value || data.email,
        linkedinUrl: bestMatch.linkedin || data.linkedinUrl,
        title: bestMatch.position || data.title,
        company: result.data.organization || data.company,
        confidence: bestMatch.confidence,
        source: 'hunter',
      };
    }
  } catch (error) {
    console.error('Hunter Domain Search error:', error);
  }
  
  return null;
}

async function enrichWithPDL(data: any, apiKey: string) {
  console.log('Enriching with People Data Labs:', { name: data.name, email: data.email, linkedinUrl: data.linkedinUrl });
  
  const url = new URL('https://api.peopledatalabs.com/v5/person/enrich');
  
  // Build params based on available data
  if (data.linkedinUrl) {
    url.searchParams.set('profile', data.linkedinUrl);
  } else if (data.email) {
    url.searchParams.set('email', data.email);
  } else if (data.name && data.company) {
    url.searchParams.set('name', data.name);
    url.searchParams.set('company', data.company);
  } else {
    return null;
  }
  
  try {
    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': apiKey,
      },
    });
    
    if (!response.ok) {
      console.error('PDL API error:', response.status, await response.text());
      return null;
    }
    
    const result: PDLResponse = await response.json();
    
    if (result.data) {
      const currentJob = result.data.current_job?.[0];
      const primaryEmail = result.data.emails?.find(e => e.type === 'professional')?.address || 
                          result.data.emails?.[0]?.address;
      
      return {
        email: primaryEmail || data.email,
        linkedinUrl: result.data.linkedin_url || data.linkedinUrl,
        title: currentJob?.title || data.title,
        company: currentJob?.company?.name || data.company,
        bio: result.data.summary || null, // LinkedIn "About" section
        confidence: 95, // PDL generally high confidence
        source: 'pdl',
        extra: {
          industry: currentJob?.company?.industry,
          companySize: currentJob?.company?.size,
        },
      };
    }
  } catch (error) {
    console.error('PDL enrichment error:', error);
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const { contactId, provider = 'auto', data }: EnrichmentRequest = await req.json();

    // Get API keys
    const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
    const pdlApiKey = Deno.env.get('PDL_API_KEY');

    if (!hunterApiKey && !pdlApiKey) {
      return new Response(
        JSON.stringify({ error: 'No enrichment API keys configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contact if only ID provided
    let contactData = data;
    if (!contactData) {
      const { data: contact, error } = await supabaseClient
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (error || !contact) {
        throw new Error('Contact not found');
      }

      contactData = {
        name: contact.name,
        email: contact.email,
        company: contact.company,
        linkedinUrl: contact.linkedin_url,
        title: contact.title,
      };
    }

    let enrichedData = null;

    // Try enrichment based on provider preference
    if (provider === 'hunter' || (provider === 'auto' && hunterApiKey)) {
      if (hunterApiKey) {
        enrichedData = await enrichWithHunter(contactData, hunterApiKey);
      }
    }

    if (!enrichedData && (provider === 'pdl' || provider === 'auto')) {
      if (pdlApiKey) {
        enrichedData = await enrichWithPDL(contactData, pdlApiKey);
      }
    }

    // Try the other provider if first one failed and provider is 'auto'
    if (!enrichedData && provider === 'auto') {
      if (!hunterApiKey && pdlApiKey) {
        enrichedData = await enrichWithPDL(contactData, pdlApiKey);
      } else if (hunterApiKey && !pdlApiKey) {
        enrichedData = await enrichWithHunter(contactData, hunterApiKey);
      }
    }

    if (!enrichedData) {
      return new Response(
        JSON.stringify({ 
          error: 'No enrichment data found',
          message: 'Could not find additional information for this contact'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        data: enrichedData,
        original: contactData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Enrichment error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

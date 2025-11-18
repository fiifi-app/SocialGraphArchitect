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
    location_name: string;
    location_locality: string;
    location_region: string;
    location_country: string;
    mobile_phone: string;
    phone_numbers: Array<string>;
    twitter_url: string;
    facebook_url: string;
    github_url: string;
    job_title: string;
    job_company_name: string;
    job_company_website: string;
    job_company_size: string;
    job_company_founded: number;
    job_company_industry: string;
    job_company_location_name: string;
    job_company_location_locality: string;
    job_company_location_region: string;
    job_company_location_country: string;
    job_company_location_street_address: string;
    job_company_location_address_line_2: string;
    job_company_location_postal_code: string;
    job_company_linkedin_url: string;
    job_company_twitter_url: string;
    job_company_facebook_url: string;
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
      const primaryEmail = result.data.emails?.find(e => e.type === 'professional')?.address || 
                          result.data.emails?.[0]?.address;
      
      // Format location
      const location = result.data.location_name || 
                      [result.data.location_locality, result.data.location_region, result.data.location_country]
                        .filter(Boolean).join(', ') || null;
      
      // Format company address
      const companyAddress = [
        result.data.job_company_location_street_address,
        result.data.job_company_location_address_line_2,
        result.data.job_company_location_locality,
        result.data.job_company_location_region,
        result.data.job_company_location_postal_code,
        result.data.job_company_location_country
      ].filter(Boolean).join(', ') || null;
      
      // Get phone number (prefer mobile, fallback to first phone number)
      const phone = result.data.mobile_phone || result.data.phone_numbers?.[0] || null;
      
      return {
        // Personal information
        firstName: result.data.first_name || data.firstName,
        lastName: result.data.last_name || data.lastName,
        email: primaryEmail || data.email,
        linkedinUrl: result.data.linkedin_url || data.linkedinUrl,
        title: result.data.job_title || data.title,
        company: result.data.job_company_name || data.company,
        location: location || data.location,
        phone: phone || data.phone,
        bio: result.data.summary || data.bio,
        twitter: result.data.twitter_url || data.twitter,
        
        // Company information
        companyUrl: result.data.job_company_website || data.companyUrl,
        companyAddress: companyAddress || data.companyAddress,
        companyEmployees: result.data.job_company_size || data.companyEmployees,
        companyFounded: result.data.job_company_founded?.toString() || data.companyFounded,
        companyLinkedin: result.data.job_company_linkedin_url || data.companyLinkedin,
        companyTwitter: result.data.job_company_twitter_url || data.companyTwitter,
        companyFacebook: result.data.job_company_facebook_url || data.companyFacebook,
        
        // Metadata
        confidence: 95, // PDL generally high confidence
        source: 'pdl',
        extra: {
          industry: result.data.job_company_industry,
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
        firstName: contact.first_name,
        lastName: contact.last_name,
        email: contact.email,
        company: contact.company,
        linkedinUrl: contact.linkedin_url,
        title: contact.title,
        location: contact.location,
        phone: contact.phone,
        bio: contact.bio,
        twitter: contact.twitter,
        companyUrl: contact.company_url,
        companyAddress: contact.company_address,
        companyEmployees: contact.company_employees,
        companyFounded: contact.company_founded,
        companyLinkedin: contact.company_linkedin,
        companyTwitter: contact.company_twitter,
        companyFacebook: contact.company_facebook,
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  meta?: {
    params: any;
  };
  errors?: Array<{ id: string; code: number; details: string }>;
}

interface HunterAccountResponse {
  data: {
    email: string;
    first_name: string;
    last_name: string;
    requests: {
      searches: { used: number; available: number };
      verifications: { used: number; available: number };
    };
  };
}

async function getHunterAccountInfo(apiKey: string): Promise<HunterAccountResponse | null> {
  try {
    const url = new URL('https://api.hunter.io/v2/account');
    url.searchParams.set('api_key', apiKey);
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('Hunter account check failed:', response.status);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Hunter account check error:', error);
    return null;
  }
}

async function findEmail(
  firstName: string, 
  lastName: string, 
  domain: string, 
  apiKey: string
): Promise<HunterEmailFinderResponse | null> {
  try {
    const url = new URL('https://api.hunter.io/v2/email-finder');
    url.searchParams.set('domain', domain);
    url.searchParams.set('first_name', firstName);
    url.searchParams.set('last_name', lastName);
    url.searchParams.set('api_key', apiKey);
    
    const response = await fetch(url.toString());
    const result = await response.json();
    
    if (result.errors && result.errors.length > 0) {
      console.log('Hunter API error:', result.errors);
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('Hunter email finder error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const hunterApiKey = Deno.env.get('HUNTER_API_KEY');

    if (!hunterApiKey) {
      return new Response(
        JSON.stringify({ error: 'Hunter.io API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user is authenticated
    const authClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );
    
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { action, limit = 1 } = await req.json();

    // Action: check - Get account status
    if (action === 'check') {
      const accountInfo = await getHunterAccountInfo(hunterApiKey);
      
      if (!accountInfo) {
        return new Response(
          JSON.stringify({ error: 'Could not fetch Hunter.io account info' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Count contacts that need email enrichment
      const { count: pendingCount } = await supabaseClient
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('email', null)
        .not('company', 'is', null);

      return new Response(
        JSON.stringify({
          account: {
            searches: accountInfo.data.requests.searches,
            verifications: accountInfo.data.requests.verifications,
          },
          pending: pendingCount || 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: process - Process contacts in batch
    if (action === 'process') {
      // Check remaining credits first
      const accountInfo = await getHunterAccountInfo(hunterApiKey);
      if (!accountInfo) {
        return new Response(
          JSON.stringify({ error: 'Could not verify Hunter.io credits' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const availableSearches = accountInfo.data.requests.searches.available - 
                                accountInfo.data.requests.searches.used;
      
      if (availableSearches <= 0) {
        return new Response(
          JSON.stringify({ 
            error: 'No Hunter.io search credits remaining',
            credits: accountInfo.data.requests.searches
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Limit to available credits
      const processLimit = Math.min(limit, availableSearches);

      // Get contacts that need email and have company info
      // Prioritize contacts with name + company but no email
      const { data: contacts, error: fetchError } = await supabaseClient
        .from('contacts')
        .select('id, name, first_name, last_name, company, company_url, email')
        .eq('user_id', user.id)
        .is('email', null)
        .not('company', 'is', null)
        .not('name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(processLimit);

      if (fetchError) {
        throw new Error(`Failed to fetch contacts: ${fetchError.message}`);
      }

      if (!contacts || contacts.length === 0) {
        return new Response(
          JSON.stringify({ 
            message: 'No contacts need email enrichment',
            processed: 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results: Array<{
        contactId: string;
        name: string;
        success: boolean;
        email?: string;
        confidence?: number;
        error?: string;
      }> = [];

      for (const contact of contacts) {
        // Parse name
        let firstName = contact.first_name;
        let lastName = contact.last_name;
        
        if (!firstName && contact.name) {
          const parts = contact.name.split(' ');
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }

        if (!firstName || !lastName) {
          results.push({
            contactId: contact.id,
            name: contact.name,
            success: false,
            error: 'Missing first or last name',
          });
          continue;
        }

        // Extract domain from company
        let domain: string | null = null;
        
        // Try company_url first
        if (contact.company_url) {
          try {
            const url = new URL(contact.company_url.startsWith('http') ? 
              contact.company_url : `https://${contact.company_url}`);
            domain = url.hostname.replace('www.', '');
          } catch {
            // URL parse failed
          }
        }
        
        // Fallback: guess domain from company name
        if (!domain && contact.company) {
          // Simple heuristic: company name to domain
          const companyClean = contact.company
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 30);
          domain = `${companyClean}.com`;
        }

        if (!domain) {
          results.push({
            contactId: contact.id,
            name: contact.name,
            success: false,
            error: 'Could not determine company domain',
          });
          continue;
        }

        // Call Hunter API
        const hunterResult = await findEmail(firstName, lastName, domain, hunterApiKey);

        if (hunterResult?.data?.email) {
          // Update contact with found email
          const { error: updateError } = await supabaseClient
            .from('contacts')
            .update({ 
              email: hunterResult.data.email,
              updated_at: new Date().toISOString()
            })
            .eq('id', contact.id);

          if (updateError) {
            results.push({
              contactId: contact.id,
              name: contact.name,
              success: false,
              error: `Update failed: ${updateError.message}`,
            });
          } else {
            results.push({
              contactId: contact.id,
              name: contact.name,
              success: true,
              email: hunterResult.data.email,
              confidence: hunterResult.data.confidence,
            });
          }
        } else {
          results.push({
            contactId: contact.id,
            name: contact.name,
            success: false,
            error: 'No email found',
          });
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Get updated credits
      const updatedAccount = await getHunterAccountInfo(hunterApiKey);

      return new Response(
        JSON.stringify({
          processed: results.length,
          successful: results.filter(r => r.success).length,
          results,
          credits: updatedAccount?.data.requests.searches,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "check" or "process"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Hunter batch error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

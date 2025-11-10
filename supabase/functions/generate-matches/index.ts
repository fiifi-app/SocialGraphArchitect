import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { conversationId } = await req.json();
    
    // Verify conversation ownership
    const { data: conversation } = await supabase
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
    
    const { data: entities } = await supabase
      .from('conversation_entities')
      .select('*')
      .eq('conversation_id', conversationId);
    
    const { data: contacts } = await supabase
      .from('contacts')
      .select(`
        *,
        theses (*)
      `)
      .eq('owned_by_profile', user.id);
    
    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entitySummary = entities?.reduce((acc, e) => {
      if (!acc[e.entity_type]) acc[e.entity_type] = [];
      acc[e.entity_type].push(e.value);
      return acc;
    }, {} as Record<string, string[]>) || {};

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: `You are a relationship matching engine for VCs and investors. 
          Score each contact based on how well their thesis matches the conversation entities.
          
          IMPORTANT: Partial matches are valuable! Contacts don't need to match ALL criteria.
          Even if only one field matches (e.g., just "pre-seed" stage), include it as a match.
          
          Scoring guidelines:
          - 3 stars: Strong match (3+ overlapping criteria OR perfect fit for key criteria)
          - 2 stars: Medium match (2 overlapping criteria OR good fit on important criteria)
          - 1 star: Weak match (1 overlapping criterion OR relevant but not perfect fit)
          
          Match on ANY of these:
          - Investment stage (pre-seed, seed, Series A, etc.)
          - Sector/vertical (B2B SaaS, fintech, healthcare, AI, etc.)
          - Check size ($1M, $5M, etc.)
          - Geography (SF Bay Area, NYC, remote, etc.)
          - Persona type (GP, angel, family office, etc.)
          
          Return JSON array (include ALL matches, even 1-star):
          - contact_id: string
          - score: number (1-3)
          - reasons: string[] (what matched, e.g., ["stage: pre-seed", "sector: B2B SaaS"])
          - justification: string (brief explanation why this is a good intro)
          `
        }, {
          role: 'user',
          content: JSON.stringify({
            entities: entitySummary,
            contacts: contacts.map(c => ({
              id: c.id,
              name: c.name,
              company: c.company,
              theses: c.theses
            }))
          })
        }],
        temperature: 0.5,
      }),
    });

    const openaiData = await openaiResponse.json();
    const matches = JSON.parse(openaiData.choices[0].message.content);
    
    const { data: insertedMatches } = await supabase
      .from('match_suggestions')
      .insert(
        matches.map((m: any) => ({
          conversation_id: conversationId,
          contact_id: m.contact_id,
          score: m.score,
          reasons: m.reasons,
          justification: m.justification,
          status: 'pending',
        }))
      )
      .select();
    
    return new Response(
      JSON.stringify({ matches: insertedMatches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

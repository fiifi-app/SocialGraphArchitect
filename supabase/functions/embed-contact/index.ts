import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!text || text.trim().length === 0) {
    return null;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit to avoid token limits
      }),
    });
    
    if (!response.ok) {
      console.error('OpenAI embedding error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return null;
  }
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

    const { contactId, mode = 'single' } = await req.json();
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    if (mode === 'batch') {
      // Batch mode: process all contacts without embeddings
      const { data: contacts, error: fetchError } = await supabaseService
        .from('contacts')
        .select('id, name, bio, investor_notes, title, company')
        .eq('owned_by_profile', user.id)
        .is('bio_embedding', null)
        .limit(50); // Process 50 at a time
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (!contacts || contacts.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No contacts need embeddings', processed: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      let processed = 0;
      const errors: string[] = [];
      
      for (const contact of contacts) {
        try {
          // Build text for bio embedding
          const bioText = [
            contact.bio,
            contact.title ? `Title: ${contact.title}` : '',
            contact.company ? `Company: ${contact.company}` : '',
          ].filter(Boolean).join('\n');
          
          // Build text for thesis embedding
          const thesisText = contact.investor_notes || '';
          
          const bioEmbedding = bioText ? await generateEmbedding(bioText, openaiApiKey) : null;
          const thesisEmbedding = thesisText ? await generateEmbedding(thesisText, openaiApiKey) : null;
          
          if (bioEmbedding || thesisEmbedding) {
            const updateData: any = {};
            if (bioEmbedding) updateData.bio_embedding = JSON.stringify(bioEmbedding);
            if (thesisEmbedding) updateData.thesis_embedding = JSON.stringify(thesisEmbedding);
            
            const { error: updateError } = await supabaseService
              .from('contacts')
              .update(updateData)
              .eq('id', contact.id);
            
            if (updateError) {
              errors.push(`${contact.name}: ${updateError.message}`);
            } else {
              processed++;
            }
          }
          
          // Rate limiting: wait 100ms between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          errors.push(`${contact.name}: ${err.message}`);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          message: `Processed ${processed} contacts`,
          processed,
          total: contacts.length,
          errors: errors.length > 0 ? errors : undefined,
          hasMore: contacts.length === 50,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Single contact mode
    if (!contactId) {
      throw new Error('contactId is required');
    }
    
    // Verify contact ownership
    const { data: contact, error: fetchError } = await supabaseService
      .from('contacts')
      .select('id, name, bio, investor_notes, title, company, owned_by_profile')
      .eq('id', contactId)
      .single();
    
    if (fetchError || !contact) {
      throw new Error('Contact not found');
    }
    
    if (contact.owned_by_profile !== user.id) {
      throw new Error('Forbidden: You do not own this contact');
    }
    
    // Build text for bio embedding
    const bioText = [
      contact.bio,
      contact.title ? `Title: ${contact.title}` : '',
      contact.company ? `Company: ${contact.company}` : '',
    ].filter(Boolean).join('\n');
    
    // Build text for thesis embedding  
    const thesisText = contact.investor_notes || '';
    
    console.log(`Generating embeddings for contact: ${contact.name}`);
    console.log(`Bio text length: ${bioText.length}, Thesis text length: ${thesisText.length}`);
    
    const bioEmbedding = bioText ? await generateEmbedding(bioText, openaiApiKey) : null;
    const thesisEmbedding = thesisText ? await generateEmbedding(thesisText, openaiApiKey) : null;
    
    if (!bioEmbedding && !thesisEmbedding) {
      return new Response(
        JSON.stringify({ message: 'No text available to generate embeddings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Update contact with embeddings
    const updateData: any = {};
    if (bioEmbedding) updateData.bio_embedding = JSON.stringify(bioEmbedding);
    if (thesisEmbedding) updateData.thesis_embedding = JSON.stringify(thesisEmbedding);
    
    const { error: updateError } = await supabaseService
      .from('contacts')
      .update(updateData)
      .eq('id', contactId);
    
    if (updateError) {
      throw updateError;
    }
    
    console.log(`Successfully generated embeddings for: ${contact.name}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        contact: contact.name,
        hasBioEmbedding: !!bioEmbedding,
        hasThesisEmbedding: !!thesisEmbedding,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Embed contact error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

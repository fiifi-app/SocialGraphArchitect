import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParticipantData {
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  phone?: string;
  location?: string;
  key_topics?: string[];
  conversation_context?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
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
    
    // Get conversation participants
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('*')
      .eq('conversation_id', conversationId);
    
    if (!participants || participants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No participants to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      newContacts: [],
      updatedContacts: [],
      duplicatesFound: [],
    };

    for (const participant of participants) {
      const extractedData: ParticipantData = participant.extracted_data;
      
      // Step 1: Check for duplicates
      let duplicateContact = null;
      
      // Check by email (most reliable)
      if (extractedData.email) {
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('owned_by_profile', user.id)
          .ilike('email', extractedData.email)
          .single();
        duplicateContact = data;
      }
      
      // Check by name + company if no email match
      if (!duplicateContact && extractedData.name && extractedData.company) {
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('owned_by_profile', user.id)
          .ilike('name', extractedData.name)
          .ilike('company', extractedData.company)
          .single();
        duplicateContact = data;
      }
      
      // Check by LinkedIn URL if available
      if (!duplicateContact && extractedData.linkedin_url) {
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('owned_by_profile', user.id)
          .ilike('linkedin_url', extractedData.linkedin_url)
          .single();
        duplicateContact = data;
      }

      // Step 2: Handle duplicate or new contact
      if (duplicateContact) {
        // Duplicate found - fill in blank fields
        const updates: any = {};
        let hasUpdates = false;

        // Only update fields that are currently empty/null
        if (!duplicateContact.first_name && extractedData.first_name) {
          updates.first_name = extractedData.first_name;
          hasUpdates = true;
        }
        if (!duplicateContact.last_name && extractedData.last_name) {
          updates.last_name = extractedData.last_name;
          hasUpdates = true;
        }
        if (!duplicateContact.email && extractedData.email) {
          updates.email = extractedData.email;
          hasUpdates = true;
        }
        if (!duplicateContact.company && extractedData.company) {
          updates.company = extractedData.company;
          hasUpdates = true;
        }
        if (!duplicateContact.title && extractedData.title) {
          updates.title = extractedData.title;
          hasUpdates = true;
        }
        if (!duplicateContact.linkedin_url && extractedData.linkedin_url) {
          updates.linkedin_url = extractedData.linkedin_url;
          hasUpdates = true;
        }
        if (!duplicateContact.phone && extractedData.phone) {
          updates.phone = extractedData.phone;
          hasUpdates = true;
        }
        if (!duplicateContact.location && extractedData.location) {
          updates.location = extractedData.location;
          hasUpdates = true;
        }

        if (hasUpdates) {
          updates.updated_at = new Date().toISOString();
          
          await supabase
            .from('contacts')
            .update(updates)
            .eq('id', duplicateContact.id);
          
          results.updatedContacts.push({
            contactId: duplicateContact.id,
            name: duplicateContact.name,
            fieldsUpdated: Object.keys(updates).filter(k => k !== 'updated_at'),
          });
        }
        
        results.duplicatesFound.push({
          contactId: duplicateContact.id,
          name: duplicateContact.name,
        });

      } else {
        // New contact - create as pending
        const newContact = {
          owned_by_profile: user.id,
          name: extractedData.name,
          first_name: extractedData.first_name,
          last_name: extractedData.last_name,
          email: extractedData.email,
          company: extractedData.company,
          title: extractedData.title,
          linkedin_url: extractedData.linkedin_url,
          phone: extractedData.phone,
          location: extractedData.location,
          status: 'pending', // Mark as pending for user review
          category: extractedData.conversation_context, // Store context in category for now
        };

        const { data: createdContact } = await supabase
          .from('contacts')
          .insert(newContact)
          .select()
          .single();
        
        if (createdContact) {
          results.newContacts.push({
            contactId: createdContact.id,
            name: createdContact.name,
            company: createdContact.company,
            keyTopics: extractedData.key_topics,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        results: results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Participant processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

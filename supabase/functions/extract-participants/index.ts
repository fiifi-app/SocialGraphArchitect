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
    
    // Get conversation segments
    const { data: segments } = await supabase
      .from('conversation_segments')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('start_time');
    
    if (!segments || segments.length === 0) {
      throw new Error('No conversation segments found');
    }

    // Build full transcript with speaker labels
    const transcript = segments.map(s => `${s.speaker}: ${s.text}`).join('\n');
    
    // Use GPT-4 to extract participant information
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
          content: `You are extracting information about conversation participants. 
          Analyze the transcript and identify each participant (excluding the user/owner).
          
          For each participant, extract:
          - name: Full name
          - first_name: First name only
          - last_name: Last name only  
          - email: Email address if mentioned
          - company: Company they work for
          - title: Job title/role
          - linkedin_url: LinkedIn URL if mentioned
          - phone: Phone number if mentioned
          - location: Location/city if mentioned
          - key_topics: Array of key topics or interests they discussed (max 5)
          - conversation_context: Brief summary of what was discussed (2-3 sentences)
          
          Return a JSON array of participant objects. If information is not mentioned, omit the field.
          Do NOT include the user/owner who is conducting the recording.
          
          Example output:
          [
            {
              "name": "Sarah Chen",
              "first_name": "Sarah",
              "last_name": "Chen",
              "company": "Acme Ventures",
              "title": "Partner",
              "key_topics": ["FinTech", "Seed Stage", "$500k-$2M checks"],
              "conversation_context": "Sarah is a seed-stage investor focused on FinTech. Looking for founders in payments and banking infrastructure."
            }
          ]`
        }, {
          role: 'user',
          content: transcript
        }],
        temperature: 0.3,
      }),
    });

    const openaiData = await openaiResponse.json();
    const participants = JSON.parse(openaiData.choices[0].message.content);

    // Save participants to conversation_participants table
    if (participants && participants.length > 0) {
      const participantRecords = participants.map((p: any) => ({
        conversation_id: conversationId,
        name: p.name,
        role: p.title || 'Participant',
        company: p.company,
        extracted_data: p, // Store all extracted data for later processing
      }));

      await supabase
        .from('conversation_participants')
        .insert(participantRecords);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        participants: participants 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Participant extraction error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

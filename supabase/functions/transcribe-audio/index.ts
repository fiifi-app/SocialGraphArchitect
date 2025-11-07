import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const conversationId = formData.get('conversation_id') as string;

    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the user from the request
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Verify conversation ownership
    const { data: conversation } = await supabaseClient
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

    // Convert audio to proper format for Whisper
    const audioBuffer = await audioFile.arrayBuffer();
    
    // Create FormData for OpenAI API - use the original file directly
    const openaiFormData = new FormData();
    openaiFormData.append('file', new File([audioBuffer], 'audio.webm', { type: 'audio/webm' }));
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('language', 'en');
    openaiFormData.append('response_format', 'verbose_json'); // Get timestamps for segments

    // Call OpenAI Whisper API
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: openaiFormData,
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const transcription = await openaiResponse.json();

    // Save transcription segments to database
    if (conversationId && transcription.segments && transcription.segments.length > 0) {
      try {
        // Get the maximum timestamp from existing segments to calculate cumulative offset
        // This ensures we don't create duplicate timestamps across chunks
        const { data: maxSegment, error: fetchError } = await supabaseClient
          .from('conversation_segments')
          .select('timestamp_ms')
          .eq('conversation_id', conversationId)
          .order('timestamp_ms', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (fetchError) {
          console.error('Error fetching max segment:', fetchError);
          throw new Error(`Failed to fetch max segment: ${fetchError.message}`);
        }
        
        // Calculate cumulative offset based on the chunk's duration
        // For the first chunk, offset is 0
        // For subsequent chunks, we use the current max timestamp + this chunk's duration
        // This ensures monotonically increasing timestamps without duplicates
        let timeOffsetMs = 0;
        
        if (maxSegment?.timestamp_ms != null) {
          // Add the current chunk's duration (in ms) to the previous max timestamp
          // Use the transcription's total duration to advance the timeline
          const chunkDurationMs = Math.floor((transcription.duration || 0) * 1000);
          timeOffsetMs = maxSegment.timestamp_ms + chunkDurationMs;
          console.log(`Previous max: ${maxSegment.timestamp_ms}ms, chunk duration: ${chunkDurationMs}ms, new offset: ${timeOffsetMs}ms`);
        } else {
          console.log('First chunk, offset: 0ms');
        }
        
        const segments = transcription.segments.map((segment: any) => ({
          conversation_id: conversationId,
          speaker: segment.speaker || 'Unknown',
          text: segment.text.trim(),
          timestamp_ms: Math.floor(segment.start * 1000) + timeOffsetMs,
        }));

        console.log(`Inserting ${segments.length} segments with offset ${timeOffsetMs}ms`);

        const { error: insertError } = await supabaseClient
          .from('conversation_segments')
          .insert(segments);
        
        if (insertError) {
          console.error('Database insert error:', insertError);
          throw new Error(`DB insert failed: ${insertError.message || JSON.stringify(insertError)}`);
        }
        
        console.log('Successfully inserted segments');
      } catch (dbError) {
        console.error('Database operation error:', dbError);
        throw new Error(`Database error: ${dbError.message || String(dbError)}`);
      }
    }

    return new Response(
      JSON.stringify({
        text: transcription.text,
        segments: transcription.segments,
        duration: transcription.duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

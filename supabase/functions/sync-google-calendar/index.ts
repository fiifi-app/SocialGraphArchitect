import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Get user from auth token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's Google OAuth tokens
    const { data: prefs, error: prefsError } = await supabaseClient
      .from('user_preferences')
      .select('google_access_token, google_refresh_token, google_token_expiry, google_calendar_sync_token')
      .eq('profile_id', user.id)
      .single();

    if (prefsError || !prefs || !prefs.google_access_token) {
      throw new Error('Google Calendar not connected');
    }

    // Check if token needs refresh
    let accessToken = prefs.google_access_token;
    if (prefs.google_token_expiry && new Date(prefs.google_token_expiry) < new Date()) {
      // Token expired, refresh it
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          refresh_token: prefs.google_refresh_token ?? '',
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();
      if (refreshData.access_token) {
        accessToken = refreshData.access_token;
        
        // Update stored token
        await supabaseClient
          .from('user_preferences')
          .update({
            google_access_token: accessToken,
            google_token_expiry: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
          })
          .eq('profile_id', user.id);
      }
    }

    // Fetch calendar events from Google Calendar API
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

    let calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
    
    // Use sync token for incremental sync if available
    if (prefs.google_calendar_sync_token) {
      calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?syncToken=${prefs.google_calendar_sync_token}`;
    }

    const calendarResponse = await fetch(calendarUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const calendarData = await calendarResponse.json();

    if (calendarData.error) {
      // Sync token might be invalid, do full sync
      if (calendarData.error.code === 410 || calendarData.error.code === 401) {
        const fullSyncUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
        const fullSyncResponse = await fetch(fullSyncUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const fullSyncData = await fullSyncResponse.json();
        calendarData.items = fullSyncData.items || [];
        calendarData.nextSyncToken = fullSyncData.nextSyncToken;
      } else {
        throw new Error(`Google Calendar API error: ${calendarData.error.message}`);
      }
    }

    // Sync events to database
    const events = calendarData.items || [];
    let syncedCount = 0;

    for (const event of events) {
      if (event.status === 'cancelled') {
        // Delete cancelled events
        await supabaseClient
          .from('calendar_events')
          .delete()
          .eq('external_event_id', event.id)
          .eq('owned_by_profile', user.id);
        continue;
      }

      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      
      if (!startTime || !endTime) continue;

      const attendees = event.attendees?.map((a: any) => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus,
      })) || [];

      // Upsert event
      const { error: upsertError } = await supabaseClient
        .from('calendar_events')
        .upsert({
          external_event_id: event.id,
          owned_by_profile: user.id,
          title: event.summary || 'Untitled Event',
          description: event.description || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          attendees: attendees,
          location: event.location || null,
          meeting_url: event.hangoutLink || null,
        }, {
          onConflict: 'external_event_id',
        });

      if (!upsertError) {
        syncedCount++;
      }
    }

    // Save sync token for next incremental sync
    if (calendarData.nextSyncToken) {
      await supabaseClient
        .from('user_preferences')
        .update({
          google_calendar_sync_token: calendarData.nextSyncToken,
        })
        .eq('profile_id', user.id);
    }

    return new Response(
      JSON.stringify({ success: true, syncedCount, totalEvents: events.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

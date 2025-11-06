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
      console.log(`Token expired for user ${user.id}, refreshing...`);
      
      if (!prefs.google_refresh_token) {
        console.error(`No refresh token available for user ${user.id}`);
        throw new Error('No refresh token available. Please reconnect Google Calendar.');
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          refresh_token: prefs.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();
      
      if (refreshData.error || !refreshData.access_token) {
        console.error(`Token refresh failed for user ${user.id}:`, refreshData.error);
        throw new Error(`Token refresh failed: ${refreshData.error_description || 'Unknown error'}. Please reconnect Google Calendar.`);
      }

      accessToken = refreshData.access_token;
      console.log(`Token refreshed successfully for user ${user.id}`);
      
      // Update stored token (and new refresh_token if provided)
      const updateData: any = {
        google_access_token: accessToken,
        google_token_expiry: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString(),
      };
      
      if (refreshData.refresh_token) {
        updateData.google_refresh_token = refreshData.refresh_token;
      }

      await supabaseClient
        .from('user_preferences')
        .update(updateData)
        .eq('profile_id', user.id);
    }

    // Fetch calendar events from Google Calendar API with pagination
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

    let allEvents: any[] = [];
    let nextPageToken: string | undefined;
    let nextSyncToken: string | undefined;
    let useIncrementalSync = !!prefs.google_calendar_sync_token;

    do {
      let calendarUrl: string;
      
      if (useIncrementalSync && !nextPageToken) {
        // Use sync token for incremental sync (first page only)
        calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?syncToken=${prefs.google_calendar_sync_token}`;
      } else {
        // Full sync or pagination
        calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`;
        if (nextPageToken) {
          calendarUrl += `&pageToken=${nextPageToken}`;
        }
      }

      const calendarResponse = await fetch(calendarUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const calendarData = await calendarResponse.json();

      if (calendarData.error) {
        // Sync token invalid (410) or unauthorized (401), reset and do full sync
        if (calendarData.error.code === 410 || calendarData.error.code === 401) {
          console.log(`Sync token invalid for user ${user.id} (code ${calendarData.error.code}), resetting to full sync`);
          
          // Clear sync token and retry with full sync
          await supabaseClient
            .from('user_preferences')
            .update({ google_calendar_sync_token: null })
            .eq('profile_id', user.id);
          
          useIncrementalSync = false;
          nextPageToken = undefined;
          allEvents = [];
          continue; // Retry with full sync
        } else {
          console.error(`Google Calendar API error for user ${user.id}:`, calendarData.error);
          throw new Error(`Google Calendar API error: ${calendarData.error.message}`);
        }
      }

      // Add items to collection
      if (calendarData.items) {
        allEvents.push(...calendarData.items);
      }

      // Handle pagination
      nextPageToken = calendarData.nextPageToken;
      nextSyncToken = calendarData.nextSyncToken;

      console.log(`Fetched ${calendarData.items?.length || 0} events for user ${user.id}, hasMore: ${!!nextPageToken}`);
    } while (nextPageToken);

    // Sync events to database
    let syncedCount = 0;

    for (const event of allEvents) {
      if (event.status === 'cancelled') {
        // Delete cancelled events
        const { error: deleteError } = await supabaseClient
          .from('calendar_events')
          .delete()
          .eq('external_event_id', event.id)
          .eq('owned_by_profile', user.id);
        
        if (deleteError) {
          console.error(`Failed to delete cancelled event ${event.id}:`, deleteError);
        } else {
          syncedCount++;
        }
        continue;
      }

      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      
      if (!startTime || !endTime) {
        console.warn(`Skipping event ${event.id}: missing start or end time`);
        continue;
      }

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

      if (upsertError) {
        console.error(`Failed to upsert event ${event.id}:`, upsertError);
      } else {
        syncedCount++;
      }
    }

    // Save sync token for next incremental sync
    if (nextSyncToken) {
      await supabaseClient
        .from('user_preferences')
        .update({
          google_calendar_sync_token: nextSyncToken,
        })
        .eq('profile_id', user.id);
      
      console.log(`Saved sync token for user ${user.id}`);
    }

    console.log(`Sync complete for user ${user.id}: ${syncedCount} events synced out of ${allEvents.length} total`);

    return new Response(
      JSON.stringify({ success: true, syncedCount, totalEvents: allEvents.length }),
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

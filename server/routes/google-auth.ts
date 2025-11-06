import { Router } from 'express';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
);

// Initiate Google OAuth flow
router.get('/connect', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent', // Force consent to get refresh token
    state: req.query.userId as string // Pass user ID to callback
  });
  
  res.redirect(authUrl);
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;
    
    if (!code || !userId) {
      return res.redirect('/?error=missing_parameters');
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    
    if (!tokens.access_token) {
      return res.redirect('/?error=no_access_token');
    }

    // Store tokens in user_preferences
    const { error } = await supabase
      .from('user_preferences')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token || null,
        google_token_expiry: tokens.expiry_date 
          ? new Date(tokens.expiry_date).toISOString() 
          : null,
        google_calendar_connected: true
      })
      .eq('profile_id', userId as string);

    if (error) {
      console.error('Error storing tokens:', error);
      return res.redirect('/?error=storage_failed');
    }

    // Redirect to settings with success
    res.redirect('/settings?calendar=connected');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?error=oauth_failed');
  }
});

// Disconnect Google Calendar
router.post('/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Clear tokens from user_preferences
    const { error } = await supabase
      .from('user_preferences')
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_calendar_sync_token: null,
        google_calendar_connected: false
      })
      .eq('profile_id', userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to disconnect' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

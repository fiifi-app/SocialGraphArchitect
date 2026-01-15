import { Router } from 'express';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = Router();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// OAuth callback URL - use Vercel URL if available, otherwise Replit or local
const getOAuthCallbackUrl = () => {
  if (process.env.VERCEL_URL) {
    // Vercel provides VERCEL_URL (e.g., "your-app.vercel.app")
    return `https://${process.env.VERCEL_URL}/api/auth/google/callback`;
  } else if (process.env.REPLIT_DEV_DOMAIN) {
    // Replit deployment
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`;
  } else {
    // Local development
    return `http://localhost:${process.env.PORT || '5000'}/api/auth/google/callback`;
  }
};

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  getOAuthCallbackUrl()
);

// Store pending OAuth states with expiry (in-memory, could use Redis for production)
const pendingStates = new Map<string, { userId: string, expires: number }>();

// Clean up expired states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of Array.from(pendingStates.entries())) {
    if (data.expires < now) {
      pendingStates.delete(state);
    }
  }
}, 10 * 60 * 1000);

// Initiate Google OAuth flow
router.get('/connect', async (req, res) => {
  try {
    // Extract token from query parameter (since we can't send headers with redirect)
    const token = req.query.token as string;
    if (!token) {
      return res.status(401).send('Unauthorized: Missing token');
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).send('Unauthorized: Invalid session');
    }

    // Generate CSRF-safe state token
    const state = crypto.randomBytes(32).toString('hex');
    pendingStates.set(state, {
      userId: user.id,
      expires: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      prompt: 'consent',
      state
    });
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth connect error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      console.error('OAuth callback: missing code or state');
      return res.redirect('/?error=missing_parameters');
    }

    // Validate state token
    const stateData = pendingStates.get(state as string);
    if (!stateData) {
      console.error('OAuth callback: invalid or expired state');
      return res.redirect('/?error=invalid_state');
    }

    // Remove used state token
    pendingStates.delete(state as string);

    // Check if state is expired
    if (stateData.expires < Date.now()) {
      console.error('OAuth callback: state expired');
      return res.redirect('/?error=state_expired');
    }

    const userId = stateData.userId;

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    
    if (!tokens.access_token) {
      console.error('OAuth callback: no access token received');
      return res.redirect('/?error=no_access_token');
    }

    // Verify the OAuth user matches the authenticated user by fetching profile
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

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
      .eq('profile_id', userId);

    if (error) {
      console.error('Error storing tokens:', error);
      return res.redirect('/?error=storage_failed');
    }

    console.log(`Google Calendar connected for user ${userId}, email: ${profile.email}`);
    res.redirect('/settings?calendar=connected');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?error=oauth_failed');
  }
});

// Disconnect Google Calendar
router.post('/disconnect', async (req, res) => {
  try {
    // Extract and validate Supabase session
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session' });
    }

    // Use authenticated user ID, not client-supplied
    const userId = user.id;

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
      console.error('Disconnect error:', error);
      return res.status(500).json({ error: 'Failed to disconnect' });
    }

    console.log(`Google Calendar disconnected for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

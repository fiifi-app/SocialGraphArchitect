import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging for mobile and desktop
if (typeof window !== 'undefined') {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const deviceType = isMobile ? 'MOBILE' : 'DESKTOP';
  
  console.log(`[Supabase] Device: ${deviceType}`);
  console.log(`[Supabase] URL configured: ${Boolean(supabaseUrl)}`);
  console.log(`[Supabase] Key configured: ${Boolean(supabaseAnonKey)}`);
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(`[Supabase] ❌ Credentials missing on ${deviceType}`);
    console.error('[Supabase] To fix this:');
    console.error('1. Go to Replit Secrets');
    console.error('2. Add: VITE_SUPABASE_URL with your Supabase project URL');
    console.error('3. Add: VITE_SUPABASE_ANON_KEY with your Supabase anon key');
    console.error('4. Restart the application');
  } else {
    console.log(`[Supabase] ✓ Connected on ${deviceType}`);
  }
}

const placeholderUrl = 'https://placeholder.supabase.co';
const placeholderKey = 'placeholder-key';

export const supabase = createClient(
  supabaseUrl || placeholderUrl,
  supabaseAnonKey || placeholderKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' 
        ? window.localStorage 
        : undefined,
      flowType: 'pkce'
    }
  }
);

export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

export { supabaseUrl, supabaseAnonKey };

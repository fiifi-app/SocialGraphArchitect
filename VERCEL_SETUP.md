# Vercel Setup Guide - New Project

Step-by-step guide to create a new Vercel project for the v2 repository.

## Prerequisites Checklist

Before starting, make sure you have:
- [ ] GitHub repository created and pushed (the v2 repo)
- [ ] Supabase project URL and keys ready
- [ ] Google OAuth credentials (if using Calendar features)
- [ ] Supabase access token for CI/CD

## Step 1: Create New Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** button (top right) or **"Add New Project"**
3. You'll see a list of your GitHub repositories
4. **Find and select** your v2 repository (e.g., `social_graph_v2` or whatever you named it)
5. Click **"Import"**

## Step 2: Configure Project Settings

Vercel will auto-detect your configuration, but verify:

### Framework Preset
- Should auto-detect: **Vite**
- If not, manually select: **Vite**

### Root Directory
- Leave as **`.`** (root) unless your project is in a subdirectory

### Build and Output Settings
- **Build Command**: `npm run build` (should be auto-filled)
- **Output Directory**: `dist/public` (should be auto-filled)
- **Install Command**: `npm install` (should be auto-filled)

### These should match your `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "installCommand": "npm install"
}
```

## Step 3: Add Environment Variables

**⚠️ CRITICAL**: Add these BEFORE your first deployment!

Click **"Environment Variables"** section and add:

### Required for Build (Frontend)
Add these for **Production**, **Preview**, AND **Development**:

1. **`VITE_SUPABASE_URL`**
   - Value: Your Supabase project URL
   - Example: `https://xxxxxxxxxxxxx.supabase.co`
   - Get from: Supabase Dashboard → Settings → API → Project URL
   - ✅ Check: Production, Preview, Development

2. **`VITE_SUPABASE_ANON_KEY`**
   - Value: Your Supabase anonymous/public key
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Get from: Supabase Dashboard → Settings → API → anon public key
   - ✅ Check: Production, Preview, Development

### Required for Runtime (Backend API)
Add these for **Production** and **Preview**:

3. **`SUPABASE_SERVICE_ROLE_KEY`**
   - Value: Your Supabase service role key
   - ⚠️ **SECRET**: Never expose to frontend!
   - Get from: Supabase Dashboard → Settings → API → service_role key
   - ✅ Check: Production, Preview

4. **`GOOGLE_CLIENT_ID`** (Optional - if using Calendar)
   - Value: Google OAuth Client ID
   - Get from: [Google Cloud Console](https://console.cloud.google.com/)
   - ✅ Check: Production, Preview

5. **`GOOGLE_CLIENT_SECRET`** (Optional - if using Calendar)
   - Value: Google OAuth Client Secret
   - Get from: Google Cloud Console
   - ✅ Check: Production, Preview

## Step 4: Deploy

1. Click **"Deploy"** button
2. Vercel will:
   - Install dependencies
   - Run build command
   - Deploy to production
3. Wait for build to complete (usually 2-5 minutes)

## Step 5: Configure Custom Domain (Optional)

After deployment:

1. Go to **Settings** → **Domains**
2. Add your custom domain (if you have one)
3. Follow DNS configuration instructions

## Step 6: Update Google OAuth Redirect URIs

If using Google Calendar integration:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs**:
   - `https://your-new-project.vercel.app/api/auth/google/callback`
   - `https://your-new-project-*.vercel.app/api/auth/google/callback` (for preview deployments)

## Step 7: Set Up GitHub Actions for Edge Functions

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:

   **`SUPABASE_ACCESS_TOKEN`**
   - Get from: Supabase Dashboard → Account → Access Tokens
   - Create new token if needed

   **`SUPABASE_DB_PASSWORD`**
   - Your Supabase database password

3. Update `.github/workflows/deploy-functions.yml`:
   - Change `PROJECT_REF: mtelyxosqqaeadrrrtgk` to your Supabase project reference ID
   - Find it in: Supabase Dashboard URL → `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

## Step 8: Verify Deployment

1. Visit your deployment URL: `https://your-project.vercel.app`
2. Check that:
   - ✅ App loads correctly
   - ✅ Login/signup works
   - ✅ Can connect to Supabase
   - ✅ API routes work (`/api/auth/google/connect` if using Calendar)

## Step 9: Deploy Supabase Edge Functions

Edge functions will auto-deploy via GitHub Actions when you push to `main`.

To manually trigger:
1. Go to GitHub → **Actions** tab
2. Select **"Deploy Supabase Edge Functions"**
3. Click **"Run workflow"**

Or deploy manually:
```bash
supabase functions deploy <function-name> --project-ref YOUR_PROJECT_REF
```

## Troubleshooting

### Build Fails: Missing Environment Variables
**Error**: `❌ BUILD FAILED: Missing required environment variables`

**Fix**:
1. Go to Vercel → Settings → Environment Variables
2. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. ✅ Check all three environments: Production, Preview, Development
4. Redeploy

### API Routes Return 404
**Fix**:
1. Check `vercel.json` exists in root
2. Check `api/api.ts` exists and exports default handler
3. Check Vercel function logs in dashboard

### OAuth Callback Fails
**Fix**:
1. Verify Google OAuth redirect URIs include your Vercel domain
2. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in Vercel
3. Check Vercel logs for OAuth errors

## Quick Reference

### Vercel Project Settings
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist/public`
- **Install Command**: `npm install`

### Required Environment Variables
- `VITE_SUPABASE_URL` (all environments)
- `VITE_SUPABASE_ANON_KEY` (all environments)
- `SUPABASE_SERVICE_ROLE_KEY` (production/preview)
- `GOOGLE_CLIENT_ID` (optional, production/preview)
- `GOOGLE_CLIENT_SECRET` (optional, production/preview)

### GitHub Secrets (for CI/CD)
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

## Next Steps

After deployment:
1. ✅ Test the application
2. ✅ Verify Supabase connection
3. ✅ Deploy edge functions
4. ✅ Set up custom domain (if needed)
5. ✅ Configure monitoring/analytics

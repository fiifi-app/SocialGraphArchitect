# Deployment Guide - Vercel

This guide explains how to deploy the Social Graph Connector v2 to Vercel, following the same architecture as the existing deployment.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: You need an existing Supabase project
3. **GitHub Repository**: This repo should be connected to GitHub
4. **Environment Variables**: All required credentials (see below)

## Deployment Steps

### 1. Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository (`social_graph_v2`)
4. Vercel will auto-detect the framework (Vite)

### 2. Configure Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

#### Required for Frontend (Build Time)
- `VITE_SUPABASE_URL` - Your Supabase project URL
  - Get from: Supabase Dashboard → Settings → API → Project URL
  - **Important**: Set for Production, Preview, and Development environments

- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
  - Get from: Supabase Dashboard → Settings → API → anon/public key
  - **Important**: Set for Production, Preview, and Development environments

#### Required for Backend (Runtime)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
  - Get from: Supabase Dashboard → Settings → API → service_role key
  - **Warning**: Keep this secret! Never expose to frontend

- `GOOGLE_CLIENT_ID` - Google OAuth Client ID (for Calendar integration)
  - Get from: [Google Cloud Console](https://console.cloud.google.com/)
  - Optional if not using Calendar features

- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
  - Get from: Google Cloud Console
  - Optional if not using Calendar features

#### For Supabase Edge Functions
Set these in Supabase Dashboard → Edge Functions → Secrets:
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `HUNTER_API_KEY` - Hunter.io API key (optional, for contact enrichment)
- `PDL_API_KEY` - People Data Labs API key (optional, for contact enrichment)

### 3. Configure Google OAuth (if using Calendar)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://your-app.vercel.app/api/auth/google/callback`
   - `https://your-app-*.vercel.app/api/auth/google/callback` (for preview deployments)
4. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel

### 4. Configure GitHub Secrets (for CI/CD)

In your GitHub repository → Settings → Secrets and variables → Actions, add:

- `SUPABASE_ACCESS_TOKEN` - Supabase access token
  - Get from: Supabase Dashboard → Account → Access Tokens
- `SUPABASE_DB_PASSWORD` - Your Supabase database password
- Update `PROJECT_REF` in `.github/workflows/deploy-functions.yml` with your Supabase project reference ID

### 5. Deploy

1. Push your code to the `main` branch
2. Vercel will automatically:
   - Install dependencies (`npm install`)
   - Build the project (`npm run build`)
   - Deploy to production

### 6. Deploy Supabase Edge Functions

Edge functions are automatically deployed via GitHub Actions when you push to `main` and modify files in `supabase/functions/`.

To manually trigger:
1. Go to GitHub → Actions
2. Select "Deploy Supabase Edge Functions"
3. Click "Run workflow"

Or deploy manually:
```bash
supabase functions deploy <function-name> --project-ref YOUR_PROJECT_REF
```

## Architecture Overview

### Vercel Deployment Structure

- **Static Files**: Served from `dist/public` (built by Vite)
- **API Routes**: Handled by serverless function at `api/api.ts`
- **Routing**: Vercel rewrites `/api/*` to `/api/api` serverless function

### Build Process

1. **Frontend Build**: `vite build` → outputs to `dist/public`
2. **Backend Build**: `esbuild server/index.ts` → outputs to `dist/index.js`
3. **Serverless Function**: `api/api.ts` wraps Express app for Vercel

### Key Differences from Replit

- **Serverless**: No persistent server, each API request is a separate function invocation
- **Static Serving**: Vercel serves static files directly (no Express static middleware needed)
- **Environment Variables**: Must be set in Vercel dashboard (not `.env` files)
- **OAuth Callbacks**: Automatically uses `VERCEL_URL` environment variable

## Troubleshooting

### Build Fails: Missing Environment Variables

**Error**: `❌ BUILD FAILED: Missing required environment variables`

**Solution**: 
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Set them for **all environments** (Production, Preview, Development)
4. Redeploy

### API Routes Not Working

**Issue**: `/api/*` routes return 404

**Solution**:
1. Check `vercel.json` configuration
2. Ensure `api/api.ts` exists and exports default handler
3. Check Vercel function logs in dashboard

### OAuth Callback Fails

**Issue**: Google OAuth redirects fail

**Solution**:
1. Check Google Cloud Console → Authorized redirect URIs
2. Add both production and preview URLs:
   - `https://your-app.vercel.app/api/auth/google/callback`
   - `https://your-app-*.vercel.app/api/auth/google/callback`
3. Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in Vercel

### Edge Functions Not Deploying

**Issue**: GitHub Actions workflow fails

**Solution**:
1. Check GitHub Secrets are set correctly
2. Verify `PROJECT_REF` in workflow file matches your Supabase project
3. Check Supabase access token has correct permissions

## Local Development

For local development, the app still works with the Express server:

```bash
npm run dev
```

This starts the Express server on port 5000 with Vite dev server for hot reloading.

## Production vs Development

- **Development**: Uses Express server with Vite middleware (`npm run dev`)
- **Production (Vercel)**: Uses serverless functions + static file serving
- **Production (Replit)**: Uses Express server with static file serving

The code automatically detects the environment and adapts accordingly.

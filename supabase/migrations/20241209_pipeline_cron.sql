-- Background Pipeline Scheduling
-- NOTE: This migration documents how to set up automated pipeline runs.
-- The actual scheduling should be done through Supabase Dashboard or
-- by calling the Edge Function directly with proper authentication.

-- IMPORTANT: Do NOT store credentials in database settings.
-- Use Supabase Vault or Edge Function secrets for credentials.

-- For pg_cron (requires Supabase Pro):
-- The recommended approach is to use Supabase's built-in cron functionality
-- through the Dashboard rather than storing credentials in the database.

/*
OPTION 1: Supabase Dashboard Cron (Recommended - Pro Plan)
1. Go to Supabase Dashboard → Database → Extensions → Enable pg_cron
2. Go to Supabase Dashboard → Database → Scheduled Jobs
3. Create a new job that calls your Edge Function via pg_net

OPTION 2: External Scheduler (Works on Free Plan)
Use an external service like:
- Vercel Cron
- GitHub Actions scheduled workflows
- Uptime Robot or similar services

Example GitHub Action (.github/workflows/pipeline-cron.yml):
```yaml
name: Run Pipeline Batch
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Pipeline
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/run-pipeline-batch" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json"
```

OPTION 3: Client-side Polling (Simple but requires app open)
The Settings page already includes a manual trigger button.
For automatic runs, the client can poll the Edge Function periodically.
*/

-- No SQL execution needed - this is documentation only.
-- The actual automation should be set up outside the database.

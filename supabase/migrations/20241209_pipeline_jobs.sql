-- Pipeline Jobs Table for Background Processing
-- This table tracks the state of the background enrichment pipeline

CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_by_profile UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'completed', 'failed')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Progress tracking
  current_stage TEXT DEFAULT 'enrichment' CHECK (current_stage IN ('enrichment', 'extraction', 'embedding')),
  total_contacts INTEGER DEFAULT 0,
  processed_contacts INTEGER DEFAULT 0,
  
  -- Enrichment stage progress
  enrich_total INTEGER DEFAULT 0,
  enrich_processed INTEGER DEFAULT 0,
  enrich_succeeded INTEGER DEFAULT 0,
  enrich_failed INTEGER DEFAULT 0,
  
  -- Thesis extraction stage progress  
  thesis_total INTEGER DEFAULT 0,
  thesis_processed INTEGER DEFAULT 0,
  thesis_succeeded INTEGER DEFAULT 0,
  thesis_failed INTEGER DEFAULT 0,
  
  -- Embedding stage progress
  embed_total INTEGER DEFAULT 0,
  embed_processed INTEGER DEFAULT 0,
  embed_succeeded INTEGER DEFAULT 0,
  embed_failed INTEGER DEFAULT 0,
  
  -- Batch tracking
  batch_size INTEGER DEFAULT 10,
  last_processed_id UUID,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Error tracking
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  
  UNIQUE(owned_by_profile)
);

-- Add RLS policies
ALTER TABLE pipeline_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pipeline jobs"
  ON pipeline_jobs FOR SELECT
  USING (auth.uid() = owned_by_profile);

CREATE POLICY "Users can insert their own pipeline jobs"
  ON pipeline_jobs FOR INSERT
  WITH CHECK (auth.uid() = owned_by_profile);

CREATE POLICY "Users can update their own pipeline jobs"
  ON pipeline_jobs FOR UPDATE
  USING (auth.uid() = owned_by_profile);

CREATE POLICY "Users can delete their own pipeline jobs"
  ON pipeline_jobs FOR DELETE
  USING (auth.uid() = owned_by_profile);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_enabled ON pipeline_jobs(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status ON pipeline_jobs(status);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_pipeline_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pipeline_jobs_updated_at
  BEFORE UPDATE ON pipeline_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_pipeline_jobs_updated_at();

-- Comments for documentation
COMMENT ON TABLE pipeline_jobs IS 'Tracks background pipeline processing state for each user';
COMMENT ON COLUMN pipeline_jobs.enabled IS 'Whether background processing is enabled for this user';
COMMENT ON COLUMN pipeline_jobs.status IS 'Current status: idle, running, paused, completed, failed';
COMMENT ON COLUMN pipeline_jobs.current_stage IS 'Which stage the pipeline is currently on';

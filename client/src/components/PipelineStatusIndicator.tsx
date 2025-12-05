import { usePipeline } from '@/contexts/PipelineContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, Pause, Play, X, BrainCircuit } from 'lucide-react';

export default function PipelineStatusIndicator() {
  const {
    isPipelineRunning,
    isPipelinePaused,
    pipelineStage,
    enrichProgress,
    extractionProgress,
    currentBatch,
    totalBatches,
    pauseResumePipeline,
    stopPipeline,
  } = usePipeline();

  if (!isPipelineRunning) return null;

  const progressPercent = enrichProgress.total > 0 
    ? Math.round((enrichProgress.processed / enrichProgress.total) * 100)
    : 0;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-lg p-4 min-w-[320px]"
      data-testid="pipeline-status-indicator"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" />
          <span className="font-medium text-sm">Contact Intelligence Pipeline</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7"
            onClick={pauseResumePipeline}
            data-testid="button-pipeline-pause"
          >
            {isPipelinePaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={stopPipeline}
            data-testid="button-pipeline-stop"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Batch {currentBatch}/{totalBatches} - {pipelineStage === 'enrichment' ? 'Enriching' : 'Extracting thesis'}
          </span>
          <span>{progressPercent}%</span>
        </div>
        
        <Progress value={progressPercent} className="h-2" />
        
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            Enriched: <span className="text-foreground">{enrichProgress.succeeded}</span>
          </span>
          <span className="text-muted-foreground">
            Thesis: <span className="text-foreground">{extractionProgress.succeeded}</span>
          </span>
        </div>

        {isPipelinePaused && (
          <div className="text-xs text-amber-500 flex items-center gap-1">
            <Pause className="w-3 h-3" />
            Paused - click play to resume
          </div>
        )}

        {!isPipelinePaused && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing...
          </div>
        )}
      </div>
    </div>
  );
}

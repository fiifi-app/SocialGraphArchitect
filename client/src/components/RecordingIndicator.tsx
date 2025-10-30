import { Circle, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordingIndicatorProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: string;
  onPause: () => void;
  onStop: () => void;
}

export default function RecordingIndicator({
  isRecording,
  isPaused,
  duration,
  onPause,
  onStop,
}: RecordingIndicatorProps) {
  if (!isRecording) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-card-border flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {!isPaused && (
            <div className="relative">
              <Circle className="w-3 h-3 fill-destructive text-destructive" />
              <div className="absolute inset-0 animate-ping">
                <Circle className="w-3 h-3 fill-destructive/40 text-destructive/40" />
              </div>
            </div>
          )}
          {isPaused && <Circle className="w-3 h-3 fill-orange-500 text-orange-500" />}
          <span className="font-mono text-sm" data-testid="text-recording-duration">
            {duration}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {isPaused ? "Paused" : "Recording"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPause}
          data-testid="button-pause-recording"
        >
          <Pause className="w-4 h-4 mr-2" />
          {isPaused ? "Resume" : "Pause"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onStop}
          data-testid="button-stop-recording"
        >
          <Square className="w-4 h-4 mr-2" />
          Stop
        </Button>
      </div>
    </div>
  );
}

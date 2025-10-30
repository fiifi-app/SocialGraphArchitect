import { useEffect, useRef } from "react";

interface TranscriptEntry {
  t: string;
  speaker: string | null;
  text: string;
}

interface TranscriptViewProps {
  transcript: TranscriptEntry[];
}

export default function TranscriptView({ transcript }: TranscriptViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  if (transcript.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Start speaking to see the transcript...
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto p-6 space-y-3"
      data-testid="container-transcript"
    >
      {transcript.map((entry, idx) => (
        <div key={idx} className="flex gap-4" data-testid={`transcript-entry-${idx}`}>
          <span className="font-mono text-xs text-muted-foreground flex-shrink-0 w-16">
            {new Date(entry.t).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
          <div className="flex-1">
            {entry.speaker && (
              <span className="text-sm font-medium text-foreground block mb-1">
                {entry.speaker}
              </span>
            )}
            <p className="text-base text-foreground leading-relaxed">{entry.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

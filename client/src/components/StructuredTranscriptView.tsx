import { Badge } from "@/components/ui/badge";
import { Calendar, User } from "lucide-react";
import { format } from "date-fns";

interface TranscriptEntry {
  t: string;
  speaker: string | null;
  text: string;
}

interface StructuredTranscriptViewProps {
  transcript: TranscriptEntry[];
  conversationTitle: string;
  conversationDate: Date;
}

export default function StructuredTranscriptView({ 
  transcript, 
  conversationTitle,
  conversationDate 
}: StructuredTranscriptViewProps) {
  if (transcript.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No transcript available yet
      </div>
    );
  }

  const speakers = Array.from(new Set(transcript.map(e => e.speaker).filter(Boolean)));
  const firstTimestamp = transcript[0]?.t;
  
  const groupedByTime = transcript.reduce((acc, entry, idx) => {
    const groupIndex = Math.floor(idx / 5);
    if (!acc[groupIndex]) {
      acc[groupIndex] = [];
    }
    acc[groupIndex].push(entry);
    return acc;
  }, {} as Record<number, TranscriptEntry[]>);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold mb-6">{conversationTitle}</h1>
        
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {format(conversationDate, 'EEEE')}, {format(conversationDate, 'h:mm a')}
            </span>
          </Badge>
          
          {speakers.map((speaker, idx) => (
            <Badge 
              key={idx}
              variant="secondary" 
              className="flex items-center gap-2 px-3 py-1.5"
            >
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">
                  {speaker?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <span>{speaker || 'Unknown'}</span>
            </Badge>
          ))}
        </div>

        <div className="space-y-8">
          {Object.entries(groupedByTime).map(([groupIdx, entries]) => (
            <div key={groupIdx}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-muted-foreground">#</span>
                Discussion Section {parseInt(groupIdx) + 1}
              </h2>
              <ul className="space-y-3 ml-4">
                {entries.map((entry, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="text-muted-foreground mt-1.5">•</span>
                    <div className="flex-1">
                      {entry.speaker && (
                        <span className="font-medium text-sm text-muted-foreground mr-2">
                          {entry.speaker}:
                        </span>
                      )}
                      <span className="text-base leading-relaxed">
                        {entry.text}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

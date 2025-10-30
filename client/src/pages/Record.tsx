import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RecordingIndicator from "@/components/RecordingIndicator";
import TranscriptView from "@/components/TranscriptView";
import SuggestionCard from "@/components/SuggestionCard";
import MeetingSummary from "@/components/MeetingSummary";
import IntroEmailPanel from "@/components/IntroEmailPanel";
import { Mic, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TranscriptEntry {
  t: string;
  speaker: string | null;
  text: string;
}

interface Suggestion {
  contactName: string;
  score: 1 | 2 | 3;
  reasons: string[];
}

export default function Record() {
  const [consentChecked, setConsentChecked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [duration, setDuration] = useState("00:00");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const demoTranscriptSegments = [
    {
      speaker: "Alex Chen",
      text: "We're looking to raise a $2M seed round for our AI infrastructure platform.",
      delay: 2000
    },
    {
      speaker: "Alex Chen",
      text: "We're focused on making it easier for developers to deploy agentic workflows.",
      delay: 4000
    },
    {
      speaker: "Jordan Smith",
      text: "That sounds interesting. What's your current traction?",
      delay: 6000
    },
    {
      speaker: "Jordan Smith",
      text: "Are you looking specifically for investors who understand the developer tools space?",
      delay: 8000
    },
    {
      speaker: "Alex Chen",
      text: "We have about 500 developers on our platform, mostly in the Bay Area and New York.",
      delay: 11000
    },
    {
      speaker: "Alex Chen",
      text: "We're growing 20% month over month. Yes, ideally we'd love investors who've backed DevTools before.",
      delay: 14000
    },
  ];

  const demoSuggestionUpdates = [
    {
      delay: 7000,
      suggestions: [
        {
          contactName: "Sarah Johnson",
          score: 2 as const,
          reasons: [
            "Invests in AI infra at seed stage",
            "Based in SF, matches geo preference"
          ]
        }
      ]
    },
    {
      delay: 12000,
      suggestions: [
        {
          contactName: "Sarah Johnson",
          score: 3 as const,
          reasons: [
            "Invests in AI infra at seed stage ($1-3M)",
            "Based in SF, matches geo preference",
            "Recently met 45 days ago"
          ]
        },
        {
          contactName: "Michael Park",
          score: 2 as const,
          reasons: [
            "DevTools investor at Series A",
            "Strong relationship (0.8 score)",
          ]
        }
      ]
    }
  ];

  const mockIntroMatches = [
    {
      contactA: {
        name: "Alex Chen",
        email: "alex@techflow.ai"
      },
      contactB: {
        name: "Sarah Johnson",
        email: "sarah@sequoia.com"
      },
      score: 3,
      reason: "Based on the conversation, Alex is raising a $2M seed round for their AI infrastructure platform. Given Sarah's focus on AI infra investments at the seed stage, this could be a great fit.",
      conversationContext: "Alex mentioned they're specifically looking for investors who understand the DevTools space and have experience with technical founders. Their current traction (500 developers, 20% MoM growth) aligns well with Sarah's typical investment criteria.",
      introBulletsForA: [
        "Sarah invests in AI infra at seed stage ($1-3M checks)",
        "Strong track record with technical founders in DevTools",
        "Based in SF, matches geographic focus",
        "Portfolio includes similar AI infrastructure companies"
      ],
      introBulletsForB: [
        "Alex raising $2M seed for AI infrastructure platform",
        "500 developers on platform, 20% MoM growth in Bay Area/NYC",
        "Looking for investors with DevTools expertise",
        "Strong technical team focused on agentic workflows for developers"
      ]
    }
  ];

  useEffect(() => {
    if (isRecording && !isPaused) {
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        setDuration(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  const handleStartRecording = () => {
    if (!consentChecked) return;
    setIsRecording(true);
    setTranscript([]);
    setSuggestions([]);
    setShowSummary(false);
    console.log('Demo recording started');

    demoTranscriptSegments.forEach((segment) => {
      setTimeout(() => {
        setTranscript(prev => [
          ...prev,
          {
            t: new Date().toISOString(),
            speaker: segment.speaker,
            text: segment.text
          }
        ]);
      }, segment.delay);
    });

    demoSuggestionUpdates.forEach((update) => {
      setTimeout(() => {
        setSuggestions(update.suggestions);
        toast({
          title: "New match found!",
          description: `${update.suggestions[update.suggestions.length - 1].contactName} - Score ${update.suggestions[update.suggestions.length - 1].score}`,
        });
      }, update.delay);
    });
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    console.log(isPaused ? 'Recording resumed' : 'Recording paused');
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsPaused(false);
    setShowSummary(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (transcriptTimerRef.current) clearInterval(transcriptTimerRef.current);
    console.log('Recording stopped - showing summary');
  };

  const handleSendEmail = (to: string, message: string) => {
    console.log('Sending email to:', to);
    toast({
      title: "Email sent!",
      description: `Introduction email sent to ${to}`,
    });
  };

  if (!isRecording) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center max-w-xl">
          <div className="mb-12">
            <h1 className="text-2xl font-semibold mb-3">Start a New Recording</h1>
            <p className="text-muted-foreground">
              Record conversations to get AI-powered intro suggestions in real-time
            </p>
          </div>

          <Card className="p-6 mb-8 text-left">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Recording Consent</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Before recording, please inform all participants that you're using an AI notepad to transcribe the conversation. 
                  This ensures transparency and compliance with recording laws in your jurisdiction.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-md border border-border">
              <Checkbox
                id="consent"
                checked={consentChecked}
                onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                data-testid="checkbox-consent"
              />
              <label
                htmlFor="consent"
                className="text-sm leading-relaxed cursor-pointer"
              >
                I have informed all participants about this recording and have their consent to proceed. 
                I understand that the audio will be transcribed and processed by AI.
              </label>
            </div>
          </Card>

          <Button
            size="lg"
            onClick={handleStartRecording}
            disabled={!consentChecked}
            className="w-full h-24 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-start-recording"
          >
            <Mic className="w-8 h-8 mr-3" />
            Start Recording
          </Button>
          
          {!consentChecked && (
            <p className="text-xs text-muted-foreground mt-3">
              Please check the consent box above to enable recording
            </p>
          )}
        </div>
      </div>
    );
  }

  if (showSummary) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold mb-2">Demo Meeting Summary</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{new Date().toLocaleDateString()}</span>
                <span>•</span>
                <span>{duration}</span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setShowSummary(false);
                setTranscript([]);
                setSuggestions([]);
                setDuration("00:00");
              }}
              data-testid="button-new-recording"
            >
              New Recording
            </Button>
          </div>
        </div>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
            <TabsTrigger value="transcript" data-testid="tab-transcript">Transcript</TabsTrigger>
            <TabsTrigger value="emails" data-testid="tab-emails">
              Intro Emails ({mockIntroMatches.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <MeetingSummary
                  highlights={[
                    "Team is raising $2M seed round for AI infrastructure platform",
                    "Current traction: 500 developers, 20% MoM growth",
                    "Geographic focus: Bay Area and New York",
                    "Looking for investors with DevTools experience"
                  ]}
                  decisions={[
                    "Follow up with Sarah Johnson about seed investment intro",
                    "Share deck with Michael Park by end of week"
                  ]}
                  actions={[
                    "Send updated pitch deck to Alex by Friday",
                    "Prepare investor questions document",
                    "Research comparable DevTools valuations",
                  ]}
                />
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-4">Matched Contacts</h2>
                <div className="space-y-4">
                  {suggestions.map((suggestion, idx) => (
                    <SuggestionCard
                      key={idx}
                      {...suggestion}
                      onPromise={() => console.log('Promised', suggestion.contactName)}
                      onMaybe={() => console.log('Maybe', suggestion.contactName)}
                      onDismiss={() => console.log('Dismissed', suggestion.contactName)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transcript">
            <div className="bg-card border border-card-border rounded-lg h-96">
              <TranscriptView transcript={transcript} />
            </div>
          </TabsContent>

          <TabsContent value="emails">
            <IntroEmailPanel 
              matches={mockIntroMatches}
              onSendEmail={handleSendEmail}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <RecordingIndicator
        isRecording={isRecording}
        isPaused={isPaused}
        duration={duration}
        onPause={handlePause}
        onStop={handleStop}
      />
      <div className="flex-1 flex mt-16 overflow-hidden">
        <div className="flex-1 border-r border-border overflow-hidden">
          <TranscriptView transcript={transcript} />
        </div>
        <div className="w-96 overflow-y-auto p-6 space-y-4 bg-card/50">
          <div className="sticky top-0 bg-card/90 backdrop-blur-sm pb-4 border-b border-border mb-4">
            <h2 className="text-lg font-semibold">Live Suggestions</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Updates in real-time
            </p>
          </div>
          {suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Listening for potential matches...
            </p>
          )}
          {suggestions.map((suggestion, idx) => (
            <SuggestionCard
              key={idx}
              {...suggestion}
              onPromise={() => console.log('Promised', suggestion.contactName)}
              onMaybe={() => console.log('Maybe', suggestion.contactName)}
              onDismiss={() => console.log('Dismissed', suggestion.contactName)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import ConsentBanner from "@/components/ConsentBanner";
import RecordingIndicator from "@/components/RecordingIndicator";
import TranscriptView from "@/components/TranscriptView";
import SuggestionCard from "@/components/SuggestionCard";
import { Mic } from "lucide-react";

export default function Record() {
  const [showConsent, setShowConsent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState("00:00");

  const mockTranscript = [
    {
      t: new Date().toISOString(),
      speaker: "Alex Chen",
      text: "We're looking to raise a $2M seed round for our AI infrastructure platform. We're focused on making it easier for developers to deploy agentic workflows."
    },
    {
      t: new Date(Date.now() + 5000).toISOString(),
      speaker: "Jordan Smith",
      text: "That sounds interesting. What's your current traction? And are you looking specifically for investors who understand the developer tools space?"
    },
    {
      t: new Date(Date.now() + 12000).toISOString(),
      speaker: "Alex Chen",
      text: "We have about 500 developers on our platform, mostly in the Bay Area and New York. We're growing 20% month over month. Yes, ideally we'd love investors who've backed DevTools before."
    },
  ];

  const mockSuggestions = [
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
  ];

  const handleStartRecording = () => {
    setShowConsent(true);
  };

  const handleAcceptConsent = () => {
    setShowConsent(false);
    setIsRecording(true);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsPaused(false);
  };

  if (!isRecording) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        {showConsent && (
          <ConsentBanner
            onAccept={handleAcceptConsent}
            onCancel={() => setShowConsent(false)}
          />
        )}
        <div className="text-center max-w-md">
          <div className="mb-8">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Mic className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">Ready to Record</h1>
            <p className="text-muted-foreground">
              Start a new conversation to get real-time intro suggestions
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleStartRecording}
            data-testid="button-start-recording"
          >
            <Mic className="w-5 h-5 mr-2" />
            Start Recording
          </Button>
        </div>
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
          <TranscriptView transcript={isRecording ? mockTranscript : []} />
        </div>
        <div className="w-96 overflow-y-auto p-6 space-y-4 bg-card/50">
          <div className="sticky top-0 bg-card/90 backdrop-blur-sm pb-4 border-b border-border mb-4">
            <h2 className="text-lg font-semibold">Live Suggestions</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Updates every 5 seconds
            </p>
          </div>
          {mockSuggestions.map((suggestion, idx) => (
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

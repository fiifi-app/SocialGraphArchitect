import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import RecordingIndicator from "@/components/RecordingIndicator";
import TranscriptView from "@/components/TranscriptView";
import SuggestionCard from "@/components/SuggestionCard";
import { Mic, AlertCircle } from "lucide-react";

export default function Record() {
  const [consentChecked, setConsentChecked] = useState(false);
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
    if (!consentChecked) return;
    setIsRecording(true);
    console.log('Recording started');
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    console.log(isPaused ? 'Recording resumed' : 'Recording paused');
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsPaused(false);
    console.log('Recording stopped');
  };

  if (!isRecording) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center max-w-xl">
          <div className="mb-12">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Mic className="w-12 h-12 text-primary" />
            </div>
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

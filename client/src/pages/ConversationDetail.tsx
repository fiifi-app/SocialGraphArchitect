import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import TranscriptView from "@/components/TranscriptView";
import MeetingSummary from "@/components/MeetingSummary";
import SuggestionCard from "@/components/SuggestionCard";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "wouter";

export default function ConversationDetail() {
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

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/history">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to History
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold mb-2">Meeting with Alex Chen</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>January 25, 2025</span>
              <span>•</span>
              <span>30 minutes</span>
              <span>•</span>
              <div className="flex gap-1">
                <Badge variant="outline">Alex Chen</Badge>
                <Badge variant="outline">Jordan Smith</Badge>
              </div>
            </div>
          </div>
          <Button variant="outline" data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Transcript</h2>
            <div className="bg-card border border-card-border rounded-lg h-96">
              <TranscriptView transcript={mockTranscript} />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Meeting Summary</h2>
            <MeetingSummary
              highlights={[
                "Team is raising $2M seed round for AI infrastructure platform",
                "Current traction: 500 developers, 20% MoM growth",
                "Geographic focus: Bay Area and New York",
                "Looking for investors with DevTools experience"
              ]}
              decisions={[
                "Follow up with Sarah Johnson about seed investment intro",
                "Share deck with Michael Park by end of week",
                "Schedule follow-up call for next Tuesday"
              ]}
              actions={[
                "Send updated pitch deck to Alex by Friday",
                "Prepare investor questions document",
                "Research comparable DevTools valuations",
              ]}
            />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Suggested Intros</h2>
          <div className="space-y-4">
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
    </div>
  );
}

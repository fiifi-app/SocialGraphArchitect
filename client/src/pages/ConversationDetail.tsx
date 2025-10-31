import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TranscriptView from "@/components/TranscriptView";
import MeetingSummary from "@/components/MeetingSummary";
import PersonSection from "@/components/PersonSection";
import SuggestionCard from "@/components/SuggestionCard";
import IntroEmailPanel from "@/components/IntroEmailPanel";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface PromisedIntro {
  id: string;
  contactName: string;
  promisedDate: string;
  fulfilled: boolean;
}

export default function ConversationDetail() {
  const { toast } = useToast();
  const [promisedIntros, setPromisedIntros] = useState<Record<string, PromisedIntro[]>>({});

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

  const conversationParticipants = [
    {
      name: "Alex Chen",
      role: "CEO",
      company: "TechFlow AI",
    },
    {
      name: "Jordan Smith",
      role: "Investor",
      company: "Sequoia Capital",
    }
  ];

  const handlePromiseIntro = (participant: string, contactName: string) => {
    const newPromise: PromisedIntro = {
      id: `${Date.now()}-${Math.random()}`,
      contactName,
      promisedDate: new Date().toISOString(),
      fulfilled: false,
    };
    setPromisedIntros(prev => ({
      ...prev,
      [participant]: [...(prev[participant] || []), newPromise]
    }));
    toast({
      title: "Intro promised!",
      description: `You promised to introduce ${participant} to ${contactName}`,
    });
  };

  const handleMarkFulfilled = (participant: string, promiseId: string) => {
    setPromisedIntros(prev => {
      const updated = { ...prev };
      updated[participant] = (updated[participant] || []).map(promise =>
        promise.id === promiseId ? { ...promise, fulfilled: true } : promise
      );
      return updated;
    });
    toast({
      title: "Intro completed!",
      description: "Marked intro as complete",
    });
  };

  const getPersonPromises = (personName: string) => {
    const promised = promisedIntros[personName] || [];
    return promised.map(promise => ({
      ...promise,
      onMarkFulfilled: () => handleMarkFulfilled(personName, promise.id),
    }));
  };

  const mockSuggestions = [
    {
      participant: "Alex Chen",
      contactName: "Sarah Johnson",
      score: 3 as const,
      reasons: [
        "Invests in AI infra at seed stage ($1-3M)",
        "Based in SF, matches geo preference",
        "Recently met 45 days ago"
      ]
    },
    {
      participant: "Alex Chen",
      contactName: "Michael Park",
      score: 2 as const,
      reasons: [
        "DevTools investor at Series A",
        "Strong relationship (0.8 score)",
      ]
    },
    {
      participant: "Jordan Smith",
      contactName: "Emily Rodriguez",
      score: 3 as const,
      reasons: [
        "Active in developer tools ecosystem",
        "Strong track record with AI startups",
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
      reason: "Based on our conversation, Alex is raising a $2M seed round for their AI infrastructure platform. Given Sarah's focus on AI infra investments at the seed stage, this could be a great fit.",
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

  const handleSendEmail = (to: string, message: string) => {
    console.log('Sending email to:', to);
    console.log('Message:', message);
    toast({
      title: "Email sent!",
      description: `Introduction email sent to ${to}`,
    });
  };

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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">Suggested Intros</TabsTrigger>
          <TabsTrigger value="emails" data-testid="tab-emails">Intro Emails</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-8">
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

            <div>
              <h2 className="text-xl font-semibold mb-4">People & Promised Intros</h2>
              <div className="space-y-4">
                {conversationParticipants.map((participant, idx) => (
                  <PersonSection
                    key={idx}
                    name={participant.name}
                    role={participant.role}
                    company={participant.company}
                    promises={getPersonPromises(participant.name)}
                  />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="suggestions">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Suggested Intro Matches</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Based on the conversation, here are potential introductions you could make. Click "Promise" to commit to making the intro.
            </p>
            <div className="space-y-4">
              {mockSuggestions.map((suggestion, idx) => (
                <div key={idx}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    For {suggestion.participant}:
                  </p>
                  <SuggestionCard
                    contactName={suggestion.contactName}
                    score={suggestion.score}
                    reasons={suggestion.reasons}
                    onPromise={() => handlePromiseIntro(suggestion.participant, suggestion.contactName)}
                    onMaybe={() => console.log('Maybe', suggestion.contactName)}
                    onDismiss={() => console.log('Dismissed', suggestion.contactName)}
                  />
                </div>
              ))}
            </div>
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

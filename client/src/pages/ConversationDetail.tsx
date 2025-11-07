import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TranscriptView from "@/components/TranscriptView";
import MeetingSummary from "@/components/MeetingSummary";
import PersonSection from "@/components/PersonSection";
import SuggestionCard from "@/components/SuggestionCard";
import IntroEmailPanel from "@/components/IntroEmailPanel";
import { ArrowLeft, Download } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useConversation, useConversationSegments } from "@/hooks/useConversations";
import { useMatchSuggestions } from "@/hooks/useMatches";
import { format } from "date-fns";

interface PromisedIntro {
  id: string;
  contactName: string;
  promisedDate: string;
  fulfilled: boolean;
}

export default function ConversationDetail() {
  const [, params] = useRoute("/conversation/:id");
  const conversationId = params?.id || '';
  
  const { toast } = useToast();
  const [promisedIntros, setPromisedIntros] = useState<Record<string, PromisedIntro[]>>({});
  
  const { data: conversation, isLoading: conversationLoading } = useConversation(conversationId);
  const { data: segments = [], isLoading: segmentsLoading } = useConversationSegments(conversationId);
  const { data: matches = [], isLoading: matchesLoading } = useMatchSuggestions(conversationId);

  const transcript = useMemo(() => {
    return segments
      .filter(segment => segment.timestamp_ms != null)
      .map(segment => ({
        t: new Date(segment.timestamp_ms).toISOString(),
        speaker: segment.speaker || 'Unknown',
        text: segment.text,
      }));
  }, [segments]);

  const conversationTitle = conversation?.title || 'Conversation';
  const conversationDate = conversation?.recordedAt 
    ? format(conversation.recordedAt, 'MMMM dd, yyyy')
    : '';
  
  const duration = conversation?.duration || 0;
  const durationMinutes = Math.round(duration / 60);

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

  const suggestions = useMemo(() => {
    return matches.map(match => ({
      participant: "Conversation Participant",
      contactName: match.contact?.name || 'Unknown',
      score: match.score as (1 | 2 | 3),
      reasons: match.reasoning || []
    }));
  }, [matches]);

  const isLoading = conversationLoading || segmentsLoading || matchesLoading;

  if (isLoading) {
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
        <div className="bg-card rounded-lg border border-card-border p-8 text-center text-muted-foreground">
          Loading conversation...
        </div>
      </div>
    );
  }

  if (!conversation) {
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
        <div className="bg-card rounded-lg border border-card-border p-8 text-center text-muted-foreground">
          Conversation not found
        </div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-semibold mb-2">{conversationTitle}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{conversationDate}</span>
              {durationMinutes > 0 && (
                <>
                  <span>•</span>
                  <span>{durationMinutes} {durationMinutes === 1 ? 'minute' : 'minutes'}</span>
                </>
              )}
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
              {transcript.length > 0 ? (
                <div className="bg-card border border-card-border rounded-lg h-96">
                  <TranscriptView transcript={transcript} />
                </div>
              ) : (
                <div className="bg-card border border-card-border rounded-lg p-8 text-center text-muted-foreground">
                  No transcript available. This conversation may not have been transcribed yet.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="suggestions">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Suggested Intro Matches</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Based on the conversation, here are potential introductions you could make.
            </p>
            {suggestions.length > 0 ? (
              <div className="space-y-4">
                {suggestions.map((suggestion, idx) => (
                  <div key={idx}>
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
            ) : (
              <div className="bg-card border border-card-border rounded-lg p-8 text-center text-muted-foreground">
                No match suggestions yet. Matches will appear after the conversation is processed.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="emails">
          <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-card-border rounded-lg p-8 text-center text-muted-foreground">
              Introduction email generation coming soon
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

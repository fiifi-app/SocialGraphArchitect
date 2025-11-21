import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StructuredTranscriptView from "@/components/StructuredTranscriptView";
import MeetingSummary from "@/components/MeetingSummary";
import PersonSection from "@/components/PersonSection";
import SuggestionCard from "@/components/SuggestionCard";
import IntroEmailPanel from "@/components/IntroEmailPanel";
import { ArrowLeft, Download } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { useConversation, useConversationSegments } from "@/hooks/useConversations";
import { useMatchSuggestions, useUpdateMatchStatus } from "@/hooks/useMatches";
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
  const updateStatus = useUpdateMatchStatus(conversationId);

  const transcript = useMemo(() => {
    return segments
      .filter(segment => segment.timestampMs != null)
      .map(segment => ({
        t: new Date(segment.timestampMs).toISOString(),
        speaker: segment.speaker || 'Unknown',
        text: segment.text,
      }));
  }, [segments]);

  const conversationTitle = conversation?.title || 'Conversation';
  const displayTitle = conversationTitle.replace(/^Conversation\s*-\s*/, '');
  const conversationDate = conversation?.recordedAt 
    ? format(conversation.recordedAt, 'MMMM dd, yyyy')
    : '';
  
  const duration = conversation?.durationSeconds || 0;
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

  const handleUpdateStatus = async (matchId: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ matchId, status });
      const statusLabels: Record<string, string> = {
        promised: 'Intro promised!',
        maybe: 'Marked as maybe',
        dismissed: 'Match dismissed',
      };
      toast({
        title: statusLabels[status] || 'Status updated',
        description: status === 'promised' 
          ? 'You can now draft an introduction email' 
          : undefined,
      });
    } catch (error) {
      toast({
        title: "Error updating match",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

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
            <h1 className="text-2xl font-semibold mb-2">{displayTitle}</h1>
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

      <Tabs defaultValue="suggestions" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">Suggested Intros</TabsTrigger>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="emails" data-testid="tab-emails">Intro Emails</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {transcript.length > 0 ? (
            <div className="bg-card border border-card-border rounded-lg min-h-[600px]">
              <StructuredTranscriptView 
                transcript={transcript}
                conversationTitle={conversationTitle}
                conversationDate={conversation.recordedAt}
              />
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-lg p-8 text-center text-muted-foreground">
              No transcript available. This conversation may not have been transcribed yet.
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggestions">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Suggested Matches</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Based on the conversation, here are potential introductions you could make.
            </p>
            {matches.length > 0 ? (
              <div className="space-y-4">
                {matches.map((match) => (
                  <div key={match.id}>
                    <SuggestionCard
                      contact={{
                        name: match.contact?.name || 'Unknown',
                        email: match.contact?.email || null,
                        company: match.contact?.company || null,
                        title: match.contact?.title || null,
                      }}
                      score={match.score as (1 | 2 | 3)}
                      reasons={(match.reasons as string[]) || []}
                      status={match.status}
                      onMakeIntro={() => handleUpdateStatus(match.id, 'promised')}
                      onMaybe={() => handleUpdateStatus(match.id, 'maybe')}
                      onDismiss={() => handleUpdateStatus(match.id, 'dismissed')}
                      isPending={updateStatus.isPending}
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

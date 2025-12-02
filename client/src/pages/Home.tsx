import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, Mic } from "lucide-react";
import { useLocation } from "wouter";
import { useTodaysEvents } from "@/hooks/useUpcomingEvents";
import { useConversations } from "@/hooks/useConversations";
import RecordingDrawer from "@/components/RecordingDrawer";
import SwipeableRecordingCard from "@/components/SwipeableRecordingCard";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function HomeNew() {
  const [, setLocation] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data: todaysEvents, isLoading: eventsLoading } = useTodaysEvents();
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      return conversationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/matches/all'] });
      toast({
        title: "Recording deleted",
        description: "The recording has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete recording. Please try again.",
        variant: "destructive",
      });
      console.error('Delete error:', error);
    },
  });
  
  const { data: allMatches = [] } = useQuery<Array<{id: string; conversation_id: string; status: string}>>({
    queryKey: ['/api/matches/all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_suggestions')
        .select('id, conversation_id, status');
      if (error) throw error;
      return (data as Array<{id: string; conversation_id: string; status: string}>) || [];
    },
  });

  const { data: conversationSegments = {} } = useQuery<Record<string, string[]>>({
    queryKey: ['/api/conversation-segments/all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_segments')
        .select('conversation_id, text, timestamp_ms')
        .order('timestamp_ms', { ascending: true });
      
      if (error) throw error;
      
      const grouped: Record<string, string[]> = {};
      (data as Array<{conversation_id: string; text: string | null}> || []).forEach(segment => {
        if (!grouped[segment.conversation_id]) {
          grouped[segment.conversation_id] = [];
        }
        if (segment.text) {
          grouped[segment.conversation_id].push(segment.text);
        }
      });
      
      return grouped;
    },
  });

  const upcomingEvents = (todaysEvents || []).filter(event => {
    const now = new Date();
    return event.startTime > now;
  });

  const conversationsByDate = useMemo(() => {
    const grouped: Record<string, typeof conversations> = {};
    
    conversations.forEach(conv => {
      const dateKey = startOfDay(conv.recordedAt).toISOString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(conv);
    });

    const sorted = Object.entries(grouped).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );

    return sorted;
  }, [conversations]);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    return format(date, "EEE dd MMM");
  };

  const getDisplayTitle = (conversationId: string, title: string | null) => {
    if (title && !title.startsWith('Conversation - ')) {
      return title;
    }
    
    const segments = conversationSegments[conversationId] || [];
    if (segments.length === 0) {
      return 'Untitled Conversation';
    }
    
    const fullText = segments.join(' ');
    const words = fullText.trim().split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) {
      return 'Untitled Conversation';
    }
    
    const firstFewWords = words.slice(0, 5).join(' ');
    return firstFewWords.length > 40 
      ? firstFewWords.substring(0, 40) + '...' 
      : firstFewWords + '...';
  };

  const getConversationStats = (conversationId: string) => {
    const conversationMatches = allMatches.filter(m => m.conversation_id === conversationId);
    const introsOffered = conversationMatches.length;
    const introsMade = conversationMatches.filter(m => 
      m.status === 'accepted' || m.status === 'intro_made'
    ).length;
    
    return { introsOffered, introsMade };
  };

  return (
    <>
      <div className="pb-24">
        {/* Coming Up Section */}
        <div className="p-8 border-b">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Coming Up</h2>
          </div>

          {eventsLoading ? (
            <Card className="p-6 text-center text-muted-foreground">
              Loading events...
            </Card>
          ) : upcomingEvents.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No upcoming events found
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <Card 
                  key={event.id} 
                  className="p-4 hover-elevate cursor-pointer"
                  onClick={() => {
                    setSelectedEventId(event.id);
                    setDrawerOpen(true);
                  }}
                  data-testid={`card-event-${event.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 text-center">
                      <div className="text-2xl font-semibold">
                        {format(event.startTime, 'd')}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        {format(event.startTime, 'MMM')}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{event.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{format(event.startTime, 'h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Conversation History */}
        <div className="p-8">
          <h2 className="text-lg font-semibold mb-6">Recordings</h2>

          {conversationsLoading ? (
            <Card className="p-6 text-center text-muted-foreground">
              Loading conversations...
            </Card>
          ) : conversationsByDate.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <p className="mb-2">No recordings yet</p>
              <p className="text-sm">Click "New Meeting" to start recording</p>
            </Card>
          ) : (
            <div className="space-y-8">
              {conversationsByDate.map(([dateKey, convs]) => (
                <div key={dateKey}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {formatDateHeader(dateKey)}
                  </h3>
                  <div className="space-y-3">
                    {convs.map((conversation) => {
                      const stats = getConversationStats(conversation.id);
                      return (
                        <SwipeableRecordingCard
                          key={conversation.id}
                          conversation={conversation}
                          displayTitle={getDisplayTitle(conversation.id, conversation.title)}
                          stats={stats}
                          onClick={() => setLocation(`/conversation/${conversation.id}`)}
                          onDelete={() => deleteConversationMutation.mutate(conversation.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button
          size="lg"
          className="rounded-3xl h-[65px] w-[65px] shadow-xl hover:shadow-2xl bg-primary hover:bg-primary transition-all duration-200"
          onClick={() => setDrawerOpen(true)}
          data-testid="button-new-meeting"
        >
          <Mic className="h-[88px] w-[88px]" />
        </Button>
      </div>

      {/* Recording Drawer */}
      <RecordingDrawer 
        open={drawerOpen} 
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedEventId(null);
        }}
        eventId={selectedEventId}
      />
    </>
  );
}

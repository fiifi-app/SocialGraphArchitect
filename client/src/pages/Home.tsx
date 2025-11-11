import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Calendar, Clock, Mic } from "lucide-react";
import { useLocation } from "wouter";
import { useTodaysEvents } from "@/hooks/useUpcomingEvents";
import { useConversations } from "@/hooks/useConversations";
import RecordingDrawer from "@/components/RecordingDrawer";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export default function HomeNew() {
  const [, setLocation] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  
  const { data: todaysEvents, isLoading: eventsLoading } = useTodaysEvents();
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();

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
    if (isToday(date)) return "Earlier today";
    return format(date, "E dd MMM");
  };

  const truncateTitle = (title: string | null) => {
    if (!title) return 'Untitled Conversation';
    const words = title.trim().split(/\s+/);
    if (words.length <= 5) return title;
    return words.slice(0, 5).join(' ') + '...';
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
                      return (
                        <Card
                          key={conversation.id}
                          className="p-4 hover-elevate cursor-pointer"
                          onClick={() => setLocation(`/conversation/${conversation.id}`)}
                          data-testid={`card-conversation-${conversation.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                                <Mic className="w-6 h-6 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base mb-1">
                                {truncateTitle(conversation.title)}
                              </h4>
                              <div className="text-sm text-muted-foreground">
                                {format(conversation.recordedAt, 'h:mm')}
                              </div>
                            </div>
                          </div>
                        </Card>
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
          className="rounded-full h-14 w-14 shadow-lg"
          onClick={() => setDrawerOpen(true)}
          data-testid="button-new-meeting"
        >
          <Plus className="h-6 w-6" />
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

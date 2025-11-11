import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mic, Users, History as HistoryIcon, TrendingUp, Calendar, Clock, MapPin, RefreshCw, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { useTodaysEvents } from "@/hooks/useUpcomingEvents";
import { useGoogleCalendarSync } from "@/hooks/useGoogleCalendarSync";
import { useConversations } from "@/hooks/useConversations";
import { useIntroductionStats } from "@/hooks/useIntroductions";
import { format, differenceInMinutes } from "date-fns";
import { useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { data: todaysEvents, isLoading } = useTodaysEvents();
  const { isConnected, sync, isSyncing, syncError } = useGoogleCalendarSync();
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  const { data: introStats, isLoading: introStatsLoading } = useIntroductionStats();
  const { toast } = useToast();

  // Auto-sync Google Calendar on mount if connected
  useEffect(() => {
    if (isConnected) {
      sync();
    }
  }, [isConnected]);

  // Show sync error toast
  useEffect(() => {
    if (syncError) {
      toast({
        title: "Calendar Sync Failed",
        description: syncError.message || "Please try again later.",
        variant: "destructive",
      });
    }
  }, [syncError, toast]);
  
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalConversations = conversations.length;
    const conversationsToday = conversations.filter(c => 
      c.recordedAt && !Number.isNaN(c.recordedAt.getTime()) && c.recordedAt >= todayStart
    ).length;
    const conversationsThisWeek = conversations.filter(c => 
      c.recordedAt && !Number.isNaN(c.recordedAt.getTime()) && c.recordedAt >= weekStart
    ).length;

    return {
      conversations: {
        total: totalConversations,
        today: conversationsToday,
        thisWeek: conversationsThisWeek,
      },
      intros: introStats || { total: 0, today: 0, thisWeek: 0 },
    };
  }, [conversations, introStats]);

  const upcomingEvents = (todaysEvents || []).filter(event => {
    const now = new Date();
    return event.startTime > now;
  });

  const getEventStatus = (startTime: Date) => {
    const now = new Date();
    const minutesUntil = differenceInMinutes(startTime, now);
    
    if (minutesUntil <= 1) return { text: "Starting now", urgent: true };
    if (minutesUntil <= 5) return { text: `Starts in ${minutesUntil} min`, urgent: true };
    if (minutesUntil <= 15) return { text: `Starts in ${minutesUntil} min`, urgent: false };
    return { text: format(startTime, 'h:mm a'), urgent: false };
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-semibold mb-3">Welcome to Social Graph Connector</h1>
        <p className="text-muted-foreground text-base">
          Record conversations and get AI-powered intro suggestions based on your network
        </p>
      </div>

      {/* Upcoming Meetings Section (Granola-style) */}
      {upcomingEvents.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Coming Up
            </h2>
            {isConnected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sync()}
                disabled={isSyncing}
                data-testid="button-sync-calendar"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {upcomingEvents.slice(0, 3).map((event) => {
              const status = getEventStatus(event.startTime);
              return (
                <Link key={event.id} href={`/record?eventId=${event.id}`}>
                  <Card 
                    className="p-4 hover-elevate cursor-pointer"
                    data-testid={`card-event-${event.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className="text-center">
                          <div className="text-2xl font-semibold">
                            {format(event.startTime, 'd')}
                          </div>
                          <div className="text-xs text-muted-foreground uppercase">
                            {format(event.startTime, 'MMM')}
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-1 truncate" data-testid={`text-event-title-${event.id}`}>
                          {event.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span className={status.urgent ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}>
                              {status.text}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1 truncate">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button 
                        size="sm"
                        className="flex-shrink-0"
                        data-testid={`button-start-recording-${event.id}`}
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        Record
                      </Button>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-12">
        <Link href="/record">
          <Button
            size="lg"
            className="w-full h-32 text-xl"
            data-testid="button-start-recording"
          >
            <Mic className="w-8 h-8 mr-3" />
            Start New Recording
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Card className="p-6" data-testid="stat-card-conversations">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-chart-1/20">
              <MessageSquare className="w-5 h-5 text-chart-1" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">Total Conversations</p>
              <p className="text-3xl font-semibold mb-2" data-testid="text-total-conversations">
                {conversationsLoading ? "..." : stats.conversations.total}
              </p>
              <Separator className="my-2" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Today</span>
                  <span className="font-medium text-foreground" data-testid="text-conversations-today">
                    {conversationsLoading ? "..." : stats.conversations.today}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>This Week</span>
                  <span className="font-medium text-foreground" data-testid="text-conversations-week">
                    {conversationsLoading ? "..." : stats.conversations.thisWeek}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6" data-testid="stat-card-intros">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-chart-2/20">
              <TrendingUp className="w-5 h-5 text-chart-2" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">Intros Made</p>
              <p className="text-3xl font-semibold mb-2" data-testid="text-intros-made">
                {introStatsLoading ? "..." : stats.intros.total}
              </p>
              <Separator className="my-2" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Today</span>
                  <span className="font-medium text-foreground" data-testid="text-intros-today">
                    {introStatsLoading ? "..." : stats.intros.today}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>This Week</span>
                  <span className="font-medium text-foreground" data-testid="text-intros-week">
                    {introStatsLoading ? "..." : stats.intros.thisWeek}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/contacts">
            <Card className="p-6 hover-elevate cursor-pointer" data-testid="card-view-contacts">
              <Users className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold mb-1">View Contacts</h3>
              <p className="text-sm text-muted-foreground">
                Manage your network and investment theses
              </p>
            </Card>
          </Link>
          <Link href="/history">
            <Card className="p-6 hover-elevate cursor-pointer" data-testid="card-view-history">
              <HistoryIcon className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Conversation History</h3>
              <p className="text-sm text-muted-foreground">
                Review past meetings and suggestions
              </p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

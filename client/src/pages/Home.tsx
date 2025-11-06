import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Users, History as HistoryIcon, TrendingUp, Calendar, Clock, MapPin, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useTodaysEvents } from "@/hooks/useUpcomingEvents";
import { format, differenceInMinutes } from "date-fns";

export default function Home() {
  const { data: todaysEvents, isLoading } = useTodaysEvents();
  
  const stats = [
    { label: "Total Conversations", value: "12", icon: HistoryIcon },
    { label: "Active Contacts", value: "47", icon: Users },
    { label: "Intros Made", value: "23", icon: TrendingUp },
  ];

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
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Coming Up
          </h2>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat, idx) => (
          <Card key={idx} className="p-6" data-testid={`stat-card-${idx}`}>
            <div className="flex items-center gap-3 mb-2">
              <stat.icon className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <div className="text-3xl font-semibold" data-testid={`stat-value-${idx}`}>
              {stat.value}
            </div>
          </Card>
        ))}
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

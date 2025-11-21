import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ConversationHistoryRow from "@/components/ConversationHistoryRow";
import { Search, Download, MessageSquare, TrendingUp, UserPlus } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useIntroductionStats } from "@/hooks/useIntroductions";
import { useContacts } from "@/hooks/useContacts";
import { useConversationMatchStats } from "@/hooks/useMatches";
import { useLocation } from "wouter";

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations();
  const { data: introStats, isLoading: introStatsLoading } = useIntroductionStats();
  const { data: contacts = [], isLoading: contactsLoading } = useContacts();
  const { data: matchStats = {} } = useConversationMatchStats();

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
    
    const newContactsToday = contacts.filter(c => 
      c.createdAt && !Number.isNaN(c.createdAt.getTime()) && c.createdAt >= todayStart
    ).length;
    const newContactsThisWeek = contacts.filter(c => 
      c.createdAt && !Number.isNaN(c.createdAt.getTime()) && c.createdAt >= weekStart
    ).length;

    return {
      conversations: {
        total: totalConversations,
        today: conversationsToday,
        thisWeek: conversationsThisWeek,
      },
      intros: introStats || { total: 0, today: 0, thisWeek: 0 },
      newContacts: {
        total: contacts.length,
        today: newContactsToday,
        thisWeek: newContactsThisWeek,
      }
    };
  }, [conversations, introStats, contacts]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Conversation History</h1>
            <p className="text-muted-foreground">
              Review past meetings and intro suggestions
            </p>
          </div>
          <Button variant="outline" size="sm" data-testid="button-export-history">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4" data-testid="stat-card-conversations">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-chart-1/20">
                <MessageSquare className="w-5 h-5 text-chart-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">Total Conversations</p>
                <p className="text-2xl font-semibold mb-2" data-testid="text-total-conversations">
                  {conversationsLoading ? "..." : stats.conversations.total.toLocaleString()}
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

          <Card className="p-4" data-testid="stat-card-intros">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-chart-2/20">
                <TrendingUp className="w-5 h-5 text-chart-2" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">Intros Made</p>
                <p className="text-2xl font-semibold mb-2" data-testid="text-intros-made">
                  {introStatsLoading ? "..." : stats.intros.total.toLocaleString()}
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

          <Card className="p-4" data-testid="stat-card-new-contacts">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-chart-3/20">
                <UserPlus className="w-5 h-5 text-chart-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">New Contacts Added</p>
                <p className="text-2xl font-semibold mb-2" data-testid="text-new-contacts">
                  {contactsLoading ? "..." : stats.newContacts.total.toLocaleString()}
                </p>
                <Separator className="my-2" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Today</span>
                    <span className="font-medium text-foreground" data-testid="text-contacts-today">
                      {contactsLoading ? "..." : stats.newContacts.today}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>This Week</span>
                    <span className="font-medium text-foreground" data-testid="text-contacts-week">
                      {contactsLoading ? "..." : stats.newContacts.thisWeek}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-history"
          />
        </div>
      </div>

      {conversationsLoading ? (
        <div className="bg-card rounded-lg border border-card-border p-8 text-center text-muted-foreground">
          Loading conversations...
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-card rounded-lg border border-card-border p-8 text-center text-muted-foreground">
          No conversations yet. Start recording to see your history here.
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-card-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border sticky top-0">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-semibold">Date</th>
                <th className="py-3 px-4 text-left text-sm font-semibold">Participants</th>
                <th className="py-3 px-4 text-left text-sm font-semibold">Duration</th>
                <th className="py-3 px-4 text-left text-sm font-semibold">Intros</th>
                <th className="py-3 px-4 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => {
                const stats = matchStats[conversation.id] || { introsOffered: 0, introsMade: 0 };
                return (
                  <ConversationHistoryRow
                    key={conversation.id}
                    id={conversation.id}
                    startedAt={conversation.recordedAt.toISOString()}
                    endedAt={conversation.recordedAt.toISOString()}
                    participants={[]}
                    introsOffered={stats.introsOffered}
                    introsMade={stats.introsMade}
                    onView={() => setLocation(`/conversation/${conversation.id}`)}
                    onDelete={() => console.log('Delete', conversation.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

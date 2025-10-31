import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import ConversationHistoryRow from "@/components/ConversationHistoryRow";
import { Search, Download, MessageSquare, TrendingUp, UserPlus } from "lucide-react";

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");

  const mockConversations = [
    {
      id: "1",
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      endedAt: new Date(Date.now() - 84600000).toISOString(),
      participants: ["Alex Chen", "Jordan Smith"],
      suggestionsCount: 3,
    },
    {
      id: "2",
      startedAt: new Date(Date.now() - 172800000).toISOString(),
      endedAt: new Date(Date.now() - 170400000).toISOString(),
      participants: ["Sarah Lee", "Michael Park", "Emma Wilson"],
      suggestionsCount: 5,
    },
    {
      id: "3",
      startedAt: new Date(Date.now() - 259200000).toISOString(),
      endedAt: new Date(Date.now() - 256800000).toISOString(),
      participants: ["David Kim"],
      suggestionsCount: 2,
    },
    {
      id: "4",
      startedAt: new Date(Date.now() - 345600000).toISOString(),
      endedAt: new Date(Date.now() - 342000000).toISOString(),
      participants: ["Amanda Chen", "James Rodriguez"],
      suggestionsCount: 4,
    },
  ];

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalConversations = mockConversations.length;
    const conversationsToday = mockConversations.filter(c => 
      new Date(c.startedAt) >= todayStart
    ).length;
    const conversationsThisWeek = mockConversations.filter(c => 
      new Date(c.startedAt) >= weekStart
    ).length;

    return {
      total: totalConversations,
      today: conversationsToday,
      thisWeek: conversationsThisWeek,
      introsMade: 23,
      newContactsAdded: 8
    };
  }, [mockConversations]);

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
          <Button variant="outline" data-testid="button-export-history">
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
                <p className="text-2xl font-semibold mb-2" data-testid="text-total-conversations">{stats.total}</p>
                <Separator className="my-2" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Today</span>
                    <span className="font-medium text-foreground" data-testid="text-conversations-today">{stats.today}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>This Week</span>
                    <span className="font-medium text-foreground" data-testid="text-conversations-week">{stats.thisWeek}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4" data-testid="stat-card-intros">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-2/20">
                <TrendingUp className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Intros Made</p>
                <p className="text-2xl font-semibold" data-testid="text-intros-made">{stats.introsMade}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4" data-testid="stat-card-new-contacts">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-chart-3/20">
                <UserPlus className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">New Contacts Added</p>
                <p className="text-2xl font-semibold" data-testid="text-new-contacts">{stats.newContactsAdded}</p>
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
            {mockConversations.map((conversation) => (
              <ConversationHistoryRow
                key={conversation.id}
                {...conversation}
                onView={() => console.log('View', conversation.id)}
                onDelete={() => console.log('Delete', conversation.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

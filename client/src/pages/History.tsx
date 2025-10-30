import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ConversationHistoryRow from "@/components/ConversationHistoryRow";
import { Search, Download } from "lucide-react";

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

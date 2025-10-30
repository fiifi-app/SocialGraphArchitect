import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Users, History as HistoryIcon, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const stats = [
    { label: "Total Conversations", value: "12", icon: HistoryIcon },
    { label: "Active Contacts", value: "47", icon: Users },
    { label: "Intros Made", value: "23", icon: TrendingUp },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-semibold mb-3">Welcome to Social Graph Connector</h1>
        <p className="text-muted-foreground text-base">
          Record conversations and get AI-powered intro suggestions based on your network
        </p>
      </div>

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

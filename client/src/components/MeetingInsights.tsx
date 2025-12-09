import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Lightbulb, 
  Users, 
  Target, 
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";
import { format, subDays } from "date-fns";

interface ConversationWithContext {
  id: string;
  title: string | null;
  recorded_at: string;
  domains_and_topics: {
    sector_keywords?: string[];
    technology_keywords?: string[];
    geographic_focus?: string[];
    stage_keywords?: string[];
  } | null;
  goals_and_needs: {
    fundraising?: { investor_types?: string[]; raise_amount?: string };
    hiring?: { roles_needed?: string[] };
    customers_or_partners?: { target_types?: string[] };
  } | null;
  matching_intent: {
    what_kind_of_contacts_to_find?: string;
    urgency?: string;
  } | null;
}

interface ParticipantInfo {
  conversation_id: string;
  contact: {
    id: string;
    name: string;
    company: string | null;
    title: string | null;
  } | null;
}

interface MatchInfo {
  id: string;
  conversation_id: string;
  status: string;
  contact: {
    id: string;
    name: string;
    company: string | null;
  } | null;
}

export default function MeetingInsights() {
  const [, setLocation] = useLocation();

  const { data: recentConversations, isLoading: conversationsLoading } = useQuery<ConversationWithContext[]>({
    queryKey: ['/api/insights/conversations'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from('conversations')
        .select('id, title, recorded_at, domains_and_topics, goals_and_needs, matching_intent')
        .gte('recorded_at', sevenDaysAgo)
        .order('recorded_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return (data || []) as ConversationWithContext[];
    },
  });

  const { data: participants } = useQuery<ParticipantInfo[]>({
    queryKey: ['/api/insights/participants'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          contact:contacts(id, name, company, title)
        `)
        .gte('created_at', sevenDaysAgo);
      
      if (error) throw error;
      return (data || []) as ParticipantInfo[];
    },
  });

  const { data: pendingMatches } = useQuery<MatchInfo[]>({
    queryKey: ['/api/insights/pending-matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_suggestions')
        .select(`
          id,
          conversation_id,
          status,
          contact:contacts(id, name, company)
        `)
        .in('status', ['pending', 'promised'])
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return (data || []) as MatchInfo[];
    },
  });

  const parseJsonField = (field: any): any => {
    if (!field) return null;
    if (typeof field === 'string') {
      try { return JSON.parse(field); } catch { return null; }
    }
    return typeof field === 'object' ? field : null;
  };

  const aggregatedTopics = (() => {
    const sectors = new Set<string>();
    const technologies = new Set<string>();
    const geos = new Set<string>();

    recentConversations?.forEach(conv => {
      const domains = parseJsonField(conv.domains_and_topics);
      if (domains) {
        domains.sector_keywords?.forEach((s: string) => sectors.add(s));
        domains.technology_keywords?.forEach((t: string) => technologies.add(t));
        domains.geographic_focus?.forEach((g: string) => geos.add(g));
      }
    });

    return {
      sectors: Array.from(sectors).slice(0, 6),
      technologies: Array.from(technologies).slice(0, 4),
      geos: Array.from(geos).slice(0, 3),
    };
  })();

  const uniqueContacts = (() => {
    const contactMap = new Map<string, { name: string; company: string | null; title: string | null }>();
    participants?.forEach(p => {
      if (p.contact && !contactMap.has(p.contact.id)) {
        contactMap.set(p.contact.id, {
          name: p.contact.name,
          company: p.contact.company,
          title: p.contact.title,
        });
      }
    });
    return Array.from(contactMap.values()).slice(0, 5);
  })();

  const actionItems = (() => {
    const items: { type: string; label: string; conversationId?: string }[] = [];

    recentConversations?.forEach(conv => {
      const goals = parseJsonField(conv.goals_and_needs);
      const intent = parseJsonField(conv.matching_intent);

      if (goals?.fundraising?.investor_types?.length > 0) {
        items.push({ 
          type: 'fundraising', 
          label: `Find ${goals.fundraising.investor_types.slice(0, 2).join(', ')} investors`,
          conversationId: conv.id
        });
      }
      if (goals?.hiring?.roles_needed?.length > 0) {
        items.push({ 
          type: 'hiring', 
          label: `Hire: ${goals.hiring.roles_needed.slice(0, 2).join(', ')}`,
          conversationId: conv.id
        });
      }
      if (intent?.what_kind_of_contacts_to_find) {
        items.push({ 
          type: 'intro', 
          label: intent.what_kind_of_contacts_to_find.slice(0, 50),
          conversationId: conv.id
        });
      }
    });

    pendingMatches?.forEach(match => {
      if (match.contact) {
        items.push({
          type: match.status === 'promised' ? 'promised' : 'pending',
          label: `Intro to ${match.contact.name}${match.contact.company ? ` (${match.contact.company})` : ''}`,
          conversationId: match.conversation_id,
        });
      }
    });

    return items.slice(0, 5);
  })();

  const hasTopics = aggregatedTopics.sectors.length > 0 || 
                    aggregatedTopics.technologies.length > 0 || 
                    aggregatedTopics.geos.length > 0;
  const hasContent = hasTopics || uniqueContacts.length > 0 || actionItems.length > 0;

  if (conversationsLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Meeting Insights</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-6 w-full mb-2" />
              <Skeleton className="h-6 w-3/4" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 border-b" data-testid="section-meeting-insights">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Meeting Insights</h2>
        <Badge variant="secondary" className="ml-2">Last 7 days</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(aggregatedTopics.sectors.length > 0 || aggregatedTopics.technologies.length > 0 || aggregatedTopics.geos.length > 0) && (
          <Card className="p-4" data-testid="card-key-topics">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-muted-foreground">Key Topics</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {aggregatedTopics.sectors.map((sector, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {sector}
                </Badge>
              ))}
              {aggregatedTopics.technologies.map((tech, i) => (
                <Badge key={`tech-${i}`} variant="secondary" className="text-xs">
                  {tech}
                </Badge>
              ))}
              {aggregatedTopics.geos.map((geo, i) => (
                <Badge key={`geo-${i}`} variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30">
                  {geo}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {uniqueContacts.length > 0 && (
          <Card className="p-4" data-testid="card-contacts-discussed">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">Contacts Discussed</span>
            </div>
            <div className="space-y-2">
              {uniqueContacts.slice(0, 3).map((contact, i) => (
                <div key={i} className="text-sm">
                  <div className="font-medium truncate">{contact.name}</div>
                  {(contact.title || contact.company) && (
                    <div className="text-xs text-muted-foreground truncate">
                      {contact.title}{contact.title && contact.company ? ' at ' : ''}{contact.company}
                    </div>
                  )}
                </div>
              ))}
              {uniqueContacts.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{uniqueContacts.length - 3} more
                </div>
              )}
            </div>
          </Card>
        )}

        {actionItems.length > 0 && (
          <Card className="p-4" data-testid="card-action-items">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-muted-foreground">Action Items</span>
            </div>
            <div className="space-y-2">
              {actionItems.slice(0, 4).map((item, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-2 text-sm cursor-pointer hover-elevate rounded p-1 -m-1"
                  onClick={() => item.conversationId && setLocation(`/conversation/${item.conversationId}`)}
                  data-testid={`action-item-${i}`}
                >
                  {item.type === 'promised' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

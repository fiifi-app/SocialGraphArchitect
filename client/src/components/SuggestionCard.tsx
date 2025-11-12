import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, X, Clock, Building2, Briefcase, Star } from "lucide-react";

interface ContactDetails {
  name: string;
  email: string | null;
  company: string | null;
  title: string | null;
}

interface SuggestionCardProps {
  contact: ContactDetails;
  score: 1 | 2 | 3;
  reasons: string[];
  status?: string;
  onPromise: () => void;
  onMaybe: () => void;
  onDismiss: () => void;
  isPending?: boolean;
}

export default function SuggestionCard({
  contact,
  score,
  reasons,
  status = 'pending',
  onPromise,
  onMaybe,
  onDismiss,
  isPending = false,
}: SuggestionCardProps) {
  const scoreColors = {
    1: "bg-muted text-muted-foreground",
    2: "bg-primary/20 text-primary",
    3: "bg-primary text-primary-foreground",
  };

  const scoreLabels = {
    1: "Okay",
    2: "Good",
    3: "Highly Likely",
  };
  
  const statusColors = {
    pending: "",
    promised: "bg-accent/50",
    maybe: "bg-muted/50",
    dismissed: "opacity-60",
  };
  
  const statusIcons = {
    promised: <Check className="w-3.5 h-3.5 text-primary" />,
    maybe: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
    dismissed: <X className="w-3.5 h-3.5 text-muted-foreground" />,
  };
  
  const cardClassName = `p-4 space-y-3 ${statusColors[status as keyof typeof statusColors] || ''}`;

  return (
    <Card className={cardClassName} data-testid={`suggestion-card-${contact.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-base font-semibold truncate" data-testid="text-contact-name">
              {contact.name}
            </h4>
            {status !== 'pending' && statusIcons[status as keyof typeof statusIcons]}
          </div>
          
          {(contact.company || contact.title) && (
            <div className="space-y-1 text-sm text-muted-foreground">
              {contact.title && (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{contact.title}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{contact.company}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <Badge className="bg-transparent border-0 p-0" data-testid="badge-score">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: score }).map((_, idx) => (
              <Star key={idx} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
            ))}
          </div>
        </Badge>
      </div>
      
      {(contact.company || contact.title) && <Separator />}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Why this match:
        </p>
        <ul className="space-y-1 text-sm">
          {reasons.map((reason, idx) => (
            <li key={idx} className="flex gap-2" data-testid={`reason-${idx}`}>
              <span className="text-primary">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>
      {status === 'pending' && (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={onPromise}
            className="flex-1"
            disabled={isPending}
            data-testid="button-promise"
          >
            <Check className="w-3 h-3 mr-1" />
            Promise
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onMaybe}
            className="flex-1"
            disabled={isPending}
            data-testid="button-maybe"
          >
            <Clock className="w-3 h-3 mr-1" />
            Maybe
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDismiss}
            disabled={isPending}
            data-testid="button-dismiss"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </Card>
  );
}

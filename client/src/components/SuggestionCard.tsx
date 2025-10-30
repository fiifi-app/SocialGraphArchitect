import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, Clock } from "lucide-react";

interface SuggestionCardProps {
  contactName: string;
  score: 1 | 2 | 3;
  reasons: string[];
  onPromise: () => void;
  onMaybe: () => void;
  onDismiss: () => void;
}

export default function SuggestionCard({
  contactName,
  score,
  reasons,
  onPromise,
  onMaybe,
  onDismiss,
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

  return (
    <Card className="p-4 space-y-3" data-testid={`suggestion-card-${contactName}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold" data-testid="text-contact-name">
          {contactName}
        </h4>
        <Badge className={scoreColors[score]} data-testid="badge-score">
          {score} - {scoreLabels[score]}
        </Badge>
      </div>
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
      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          onClick={onPromise}
          className="flex-1"
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
          data-testid="button-maybe"
        >
          <Clock className="w-3 h-3 mr-1" />
          Maybe
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDismiss}
          data-testid="button-dismiss"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
}

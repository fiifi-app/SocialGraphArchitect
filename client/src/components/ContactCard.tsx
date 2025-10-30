import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, Edit, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ContactCardProps {
  id: string;
  fullName: string;
  role: string;
  org?: string;
  geo?: string;
  relationshipStrength: number;
  tags: string[];
  lastInteractionAt?: string;
  onEdit: () => void;
}

export default function ContactCard({
  id,
  fullName,
  role,
  org,
  geo,
  relationshipStrength,
  tags,
  lastInteractionAt,
  onEdit,
}: ContactCardProps) {
  const roleColors: Record<string, string> = {
    Investor: "bg-chart-1/20 text-chart-1",
    Founder: "bg-chart-2/20 text-chart-2",
    GP: "bg-chart-3/20 text-chart-3",
    LP: "bg-chart-4/20 text-chart-4",
    Operator: "bg-chart-5/20 text-chart-5",
  };

  return (
    <Card className="p-6 hover-elevate" data-testid={`contact-card-${id}`}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate" data-testid="text-contact-name">
              {fullName}
            </h3>
            <Badge className={roleColors[role] || "bg-muted text-muted-foreground"}>
              {role}
            </Badge>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            data-testid="button-edit-contact"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>

        {(org || geo) && (
          <div className="space-y-1.5 text-sm text-muted-foreground">
            {org && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="truncate">{org}</span>
              </div>
            )}
            {geo && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{geo}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Relationship Strength</span>
            <span>{Math.round(relationshipStrength * 100)}%</span>
          </div>
          <Progress value={relationshipStrength * 100} className="h-1.5" />
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((tag, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="text-xs px-2 py-0.5"
                data-testid={`tag-${idx}`}
              >
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {lastInteractionAt && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
            Last interaction:{" "}
            {new Date(lastInteractionAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

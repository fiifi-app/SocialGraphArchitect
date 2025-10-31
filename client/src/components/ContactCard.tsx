import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Building2, Edit, ExternalLink, DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

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
  
  // New fields for LP/Investor profiles
  linkedinUrl?: string;
  contactType?: 'investor' | 'lp';
  isLp?: boolean;
  checkSizeMin?: number;
  checkSizeMax?: number;
  preferredStages?: string[];
  preferredTeamSizes?: string[];
  preferredTenure?: string[];
  isFamilyOffice?: boolean;
  investmentTypes?: string[];
  avgCheckSize?: number;
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
  linkedinUrl,
  contactType = 'investor',
  isLp = false,
  checkSizeMin,
  checkSizeMax,
  preferredStages,
  preferredTeamSizes,
  preferredTenure,
  isFamilyOffice,
  investmentTypes,
  avgCheckSize,
}: ContactCardProps) {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const displayType = isLp ? 'LP' : 'Investor';
  const typeColor = isLp ? "bg-chart-4/20 text-chart-4" : "bg-chart-1/20 text-chart-1";

  return (
    <Card className="p-5 hover-elevate" data-testid={`contact-card-${id}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-base font-semibold truncate" data-testid="text-contact-name">
                {fullName}
              </h3>
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover-elevate rounded-sm p-0.5"
                  data-testid="link-linkedin"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge className={typeColor} data-testid="badge-contact-type">
                {displayType}
              </Badge>
              {isFamilyOffice && (
                <Badge variant="outline" className="text-xs" data-testid="badge-family-office">
                  Family Office
                </Badge>
              )}
            </div>
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

        {org && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4" />
            <span className="truncate">{org}</span>
          </div>
        )}

        {/* Investor-specific info */}
        {!isLp && (checkSizeMin || checkSizeMax || (preferredStages && preferredStages.length > 0)) && (
          <>
            <Separator />
            <div className="space-y-2">
              {(checkSizeMin || checkSizeMax) && (
                <div className="flex items-center gap-2 text-xs">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground" data-testid="text-check-size">
                    {checkSizeMin && checkSizeMax 
                      ? `${formatCurrency(checkSizeMin)} - ${formatCurrency(checkSizeMax)}`
                      : checkSizeMin 
                      ? `${formatCurrency(checkSizeMin)}+`
                      : `Up to ${formatCurrency(checkSizeMax!)}`}
                  </span>
                </div>
              )}
              {preferredStages && preferredStages.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {preferredStages.map((stage, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0" data-testid={`badge-stage-${idx}`}>
                        {stage}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {preferredTeamSizes && preferredTeamSizes.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <Users className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground" data-testid="text-team-sizes">
                    Team: {preferredTeamSizes.join(', ')}
                  </span>
                </div>
              )}
              {preferredTenure && preferredTenure.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground" data-testid="text-tenure">
                    {preferredTenure.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* LP-specific info */}
        {isLp && (investmentTypes && investmentTypes.length > 0 || avgCheckSize) && (
          <>
            <Separator />
            <div className="space-y-2">
              {investmentTypes && investmentTypes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {investmentTypes.map((type, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs" data-testid={`badge-investment-type-${idx}`}>
                      {type}
                    </Badge>
                  ))}
                </div>
              )}
              {avgCheckSize && (
                <div className="flex items-center gap-2 text-xs">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground" data-testid="text-avg-check">
                    Avg: {formatCurrency(avgCheckSize)}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {lastInteractionAt && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
            Last: {new Date(lastInteractionAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    </Card>
  );
}

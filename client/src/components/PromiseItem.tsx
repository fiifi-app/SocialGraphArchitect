import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PromiseItemProps {
  contactName: string;
  promisedDate: string;
  fulfilled: boolean;
  onMarkFulfilled?: () => void;
}

export default function PromiseItem({
  contactName,
  promisedDate,
  fulfilled,
  onMarkFulfilled,
}: PromiseItemProps) {
  const getDaysElapsed = () => {
    const promised = new Date(promisedDate);
    const now = new Date();
    return Math.floor((now.getTime() - promised.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getColorClass = () => {
    if (fulfilled) return "text-muted-foreground";
    const days = getDaysElapsed();
    if (days <= 1) return "text-chart-2"; // green: 0-1 days
    if (days <= 4) return "text-yellow-600 dark:text-yellow-500"; // yellow: 2-4 days
    return "text-destructive"; // red: >5 days
  };

  const getBadgeVariant = () => {
    return "outline" as const;
  };

  const getBadgeColorClass = () => {
    if (fulfilled) return "bg-muted border-border";
    const days = getDaysElapsed();
    if (days <= 1) return "bg-chart-2/20 text-chart-2 border-chart-2"; // green: 0-1 days
    if (days <= 4) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-500 border-yellow-500"; // yellow: 2-4 days
    return "bg-destructive/20 text-destructive border-destructive"; // red: >5 days
  };

  const daysElapsed = getDaysElapsed();

  return (
    <div className="flex items-center gap-3 py-2" data-testid="promise-item">
      <div className={`flex-shrink-0 ${getColorClass()}`}>
        <Clock className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium" data-testid="text-promise-contact">
            {contactName}
          </span>
          <Badge 
            variant={getBadgeVariant()} 
            className={`text-xs ${getBadgeColorClass()}`}
            data-testid="badge-promise-status"
          >
            {fulfilled 
              ? "Intro made" 
              : `${daysElapsed}d ago`
            }
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(promisedDate), { addSuffix: true })}
        </p>
      </div>
      {!fulfilled && onMarkFulfilled && (
        <Button
          size="sm"
          variant="outline"
          onClick={onMarkFulfilled}
          data-testid="button-mark-fulfilled"
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          Done
        </Button>
      )}
    </div>
  );
}

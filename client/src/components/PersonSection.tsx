import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import PromiseItem from "./PromiseItem";
import { User } from "lucide-react";

interface Promise {
  contactName: string;
  promisedDate: string;
  fulfilled: boolean;
  onMarkFulfilled?: () => void;
}

interface PersonSectionProps {
  name: string;
  role?: string;
  company?: string;
  promises: Promise[];
}

export default function PersonSection({ name, role, company, promises }: PersonSectionProps) {
  const activePromises = promises.filter(p => !p.fulfilled);
  const completedPromises = promises.filter(p => p.fulfilled);

  return (
    <Card className="p-6" data-testid="person-section">
      <div className="flex items-start gap-4 mb-4">
        <div className="p-2 rounded-full bg-primary/10">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-1" data-testid="text-person-name">
            {name}
          </h3>
          {(role || company) && (
            <p className="text-sm text-muted-foreground">
              {role}{role && company && " at "}{company}
            </p>
          )}
        </div>
        {promises.length > 0 && (
          <Badge variant="outline" data-testid="badge-promise-count">
            {activePromises.length > 0 
              ? `${activePromises.length} pending`
              : "All complete"
            }
          </Badge>
        )}
      </div>

      {promises.length > 0 ? (
        <>
          <Separator className="my-4" />
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Promised Intros
            </h4>
            <div className="space-y-1">
              {activePromises.map((promise, idx) => (
                <PromiseItem key={`active-${idx}`} {...promise} />
              ))}
              {completedPromises.map((promise, idx) => (
                <PromiseItem key={`completed-${idx}`} {...promise} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground italic">
            No intros promised yet
          </p>
        </>
      )}
    </Card>
  );
}

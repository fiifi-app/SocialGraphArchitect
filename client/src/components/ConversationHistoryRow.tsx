import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ConversationHistoryRowProps {
  id: string;
  startedAt: string;
  endedAt?: string;
  participants: string[];
  introsOffered: number;
  introsMade: number;
  onView: () => void;
  onDelete: () => void;
}

export default function ConversationHistoryRow({
  id,
  startedAt,
  endedAt,
  participants,
  introsOffered,
  introsMade,
  onView,
  onDelete,
}: ConversationHistoryRowProps) {
  const duration = endedAt
    ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
    : 0;

  return (
    <tr
      className="border-b border-border hover-elevate"
      data-testid={`conversation-row-${id}`}
    >
      <td className="py-4 px-4">
        <div className="font-mono text-sm" data-testid="text-date">
          {new Date(startedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(startedAt), { addSuffix: true })}
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex flex-wrap gap-1">
          {participants.slice(0, 2).map((p, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {p}
            </Badge>
          ))}
          {participants.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{participants.length - 2}
            </Badge>
          )}
        </div>
      </td>
      <td className="py-4 px-4 text-sm">{duration} min</td>
      <td className="py-4 px-4">
        <div className="flex gap-3 text-sm">
          <span className={introsOffered > 0 ? "text-blue-400" : "text-muted-foreground"}>
            {introsOffered} offered
          </span>
          <span className={introsMade > 0 ? "text-green-400" : "text-muted-foreground"}>
            {introsMade} made
          </span>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onView}
            data-testid="button-view-conversation"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            data-testid="button-delete-conversation"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

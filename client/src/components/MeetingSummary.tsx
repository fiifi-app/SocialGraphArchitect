import { Card } from "@/components/ui/card";
import { Lightbulb, CheckCircle, ListTodo } from "lucide-react";

interface MeetingSummaryProps {
  highlights: string[];
  decisions: string[];
  actions: string[];
}

export default function MeetingSummary({
  highlights,
  decisions,
  actions,
}: MeetingSummaryProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Key Highlights</h3>
        </div>
        <ul className="space-y-2">
          {highlights.map((item, idx) => (
            <li key={idx} className="flex gap-3" data-testid={`highlight-${idx}`}>
              <span className="text-primary mt-1">•</span>
              <span className="text-base">{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-chart-2" />
          <h3 className="text-lg font-semibold">Decisions Made</h3>
        </div>
        <ol className="space-y-2">
          {decisions.map((item, idx) => (
            <li key={idx} className="flex gap-3" data-testid={`decision-${idx}`}>
              <span className="text-chart-2 font-semibold">{idx + 1}.</span>
              <span className="text-base">{item}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ListTodo className="w-5 h-5 text-chart-4" />
          <h3 className="text-lg font-semibold">Action Items</h3>
        </div>
        <ul className="space-y-2">
          {actions.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3" data-testid={`action-${idx}`}>
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-input"
                data-testid={`checkbox-action-${idx}`}
              />
              <span className="text-base">{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

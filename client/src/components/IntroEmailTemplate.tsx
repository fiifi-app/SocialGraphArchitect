import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Send, Edit2 } from "lucide-react";
import { useState } from "react";

interface IntroEmailTemplateProps {
  recipientName: string;
  recipientEmail: string;
  introducingTo: string;
  reason: string;
  conversationContext: string;
  introBullets: string[];
  onSend: (customizedMessage: string) => void;
  onCopy: (message: string) => void;
}

export default function IntroEmailTemplate({
  recipientName,
  recipientEmail,
  introducingTo,
  reason,
  conversationContext,
  introBullets,
  onSend,
  onCopy,
}: IntroEmailTemplateProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customMessage, setCustomMessage] = useState("");

  const defaultMessage = `Hi ${recipientName},

I wanted to reach out about a potential introduction that might be valuable for you.

${reason}

${conversationContext}

Would you be open to an introduction to ${introducingTo}? I think there could be good synergy here, but I wanted to check with you first before making any connections.

Let me know if you'd be interested, and I'm happy to make the intro!

Best regards`;

  const currentMessage = customMessage || defaultMessage;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    onCopy(currentMessage);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">Double Opt-In Email</h3>
            <Badge variant="outline" className="text-xs">Draft</Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <span className="font-medium">To:</span> {recipientName} ({recipientEmail})
            </div>
            <div>
              <span className="font-medium">Subject:</span> Quick question about a potential intro
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(!isEditing)}
          data-testid="button-edit-email"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="bg-muted/30 p-4 rounded-md border border-border space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Why this intro (from transcript):
        </h4>
        <ul className="space-y-1.5">
          {introBullets.map((bullet, idx) => (
            <li key={idx} className="flex gap-2 text-sm" data-testid={`intro-bullet-${idx}`}>
              <span className="text-primary">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {isEditing ? (
        <Textarea
          value={customMessage || defaultMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          className="min-h-64 font-mono text-sm"
          data-testid="textarea-email-body"
        />
      ) : (
        <div className="bg-muted/50 p-4 rounded-md border border-border">
          <pre className="text-sm whitespace-pre-wrap font-sans" data-testid="text-email-preview">
            {currentMessage}
          </pre>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          onClick={() => onSend(currentMessage)}
          className="flex-1"
          data-testid="button-send-email"
        >
          <Send className="w-4 h-4 mr-2" />
          Send Email
        </Button>
        <Button
          variant="outline"
          onClick={handleCopy}
          data-testid="button-copy-email"
        >
          <Copy className="w-4 h-4 mr-2" />
          Copy
        </Button>
      </div>
    </Card>
  );
}

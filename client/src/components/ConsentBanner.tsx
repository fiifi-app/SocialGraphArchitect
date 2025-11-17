import { AlertCircle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

interface ConsentBannerProps {
  onAccept: () => void;
  onCancel: () => void;
  defaultText?: string;
}

export default function ConsentBanner({
  onAccept,
  onCancel,
  defaultText = "Using an AI notepad to transcribe so I don't miss details — OK?",
}: ConsentBannerProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Recording Consent</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Before starting the recording, you may want to inform participants:
            </p>
          </div>
        </div>
        <Textarea
          defaultValue={defaultText}
          className="mb-6 min-h-24"
          data-testid="input-consent-text"
        />
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel-consent"
          >
            Cancel
          </Button>
          <Button onClick={onAccept} data-testid="button-accept-consent" className="px-8">
            <Mic className="w-4 h-4 mr-2" />
            Start Recording
          </Button>
        </div>
      </Card>
    </div>
  );
}

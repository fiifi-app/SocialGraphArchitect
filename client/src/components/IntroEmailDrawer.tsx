import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Loader2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateIntroEmail } from "@/lib/edgeFunctions";

interface IntroEmailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  conversationId: string;
  contactName: string;
  onIntroMade?: () => void;
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

export default function IntroEmailDrawer({
  open,
  onOpenChange,
  matchId,
  conversationId,
  contactName,
  onIntroMade,
}: IntroEmailDrawerProps) {
  const [email, setEmail] = useState<GeneratedEmail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && !email && matchId) {
      loadEmail();
    }
  }, [open, matchId]);

  const loadEmail = async () => {
    try {
      setIsLoading(true);
      const data = await generateIntroEmail(matchId, conversationId);
      setEmail(data.email);
    } catch (error) {
      toast({
        title: "Error generating email",
        description: "Failed to generate introduction email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!email) return;
    const fullEmail = `Subject: ${email.subject}\n\n${email.body}`;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    if (onIntroMade) {
      onIntroMade();
    }
    toast({
      title: "Intro sent!",
      description: "Email copied and marked as sent",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Introduction Email</DrawerTitle>
          <DrawerDescription>
            Pre-crafted double opt-in email for {contactName}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-4 flex-1 overflow-y-auto max-h-96">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : email ? (
            <div className="space-y-4 bg-muted/50 p-4 rounded-lg">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Subject
                </p>
                <p className="text-sm font-semibold">{email.subject}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Email Body
                </p>
                <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                  {email.body}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DrawerFooter>
          <Button
            onClick={handleCopy}
            disabled={isLoading || !email}
            className="w-full"
            data-testid="button-copy-email"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Email
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
            data-testid="button-close-email"
          >
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

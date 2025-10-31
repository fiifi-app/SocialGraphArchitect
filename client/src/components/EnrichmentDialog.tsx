import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { enrichContact } from "@/lib/edgeFunctions";
import { useUpdateContact } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

interface EnrichmentDialogProps {
  contactId: string;
  contactName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: 'hunter' | 'pdl' | 'auto';
}

export default function EnrichmentDialog({
  contactId,
  contactName,
  open,
  onOpenChange,
  provider = 'auto',
}: EnrichmentDialogProps) {
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [originalData, setOriginalData] = useState<any>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const updateContact = useUpdateContact();
  const { toast } = useToast();

  const handleEnrich = async () => {
    setIsEnriching(true);
    setError(null);
    try {
      const result = await enrichContact(contactId, provider);
      setEnrichedData(result.data);
      setOriginalData(result.original);
    } catch (err: any) {
      setError(err.message || 'Failed to enrich contact');
      console.error('Enrichment error:', err);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSave = async () => {
    if (!enrichedData || !originalData) return;
    
    // Only update fields that have truthy enriched values
    const updates: any = { id: contactId };
    
    if (enrichedData.email && enrichedData.email !== originalData.email) {
      updates.email = enrichedData.email;
    }
    if (enrichedData.linkedinUrl && enrichedData.linkedinUrl !== originalData.linkedinUrl) {
      updates.linkedinUrl = enrichedData.linkedinUrl;
    }
    if (enrichedData.title && enrichedData.title !== originalData.title) {
      updates.title = enrichedData.title;
    }
    if (enrichedData.company && enrichedData.company !== originalData.company) {
      updates.company = enrichedData.company;
    }
    
    // Don't update if no changes
    if (Object.keys(updates).length === 1) {
      toast({
        title: "No changes to save",
        description: "The enriched data matches existing contact information",
      });
      return;
    }
    
    try {
      await updateContact.mutateAsync(updates);
      
      toast({
        title: "Contact enriched!",
        description: `${contactName} has been updated with new information from ${enrichedData.source}`,
      });
      
      onOpenChange(false);
      setEnrichedData(null);
      setOriginalData(null);
    } catch (err: any) {
      toast({
        title: "Failed to save",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !enrichedData) {
      handleEnrich();
    }
    onOpenChange(newOpen);
    if (!newOpen) {
      setEnrichedData(null);
      setOriginalData(null);
      setError(null);
    }
  };

  const hasChanges = enrichedData && originalData && (
    (enrichedData.email && enrichedData.email !== originalData.email) ||
    (enrichedData.linkedinUrl && enrichedData.linkedinUrl !== originalData.linkedinUrl) ||
    (enrichedData.title && enrichedData.title !== originalData.title) ||
    (enrichedData.company && enrichedData.company !== originalData.company)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-enrichment">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Enrich Contact: {contactName}
          </DialogTitle>
          <DialogDescription>
            We'll search for additional information about this contact using {provider === 'auto' ? 'available data sources' : provider === 'hunter' ? 'Hunter.io' : 'People Data Labs'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isEnriching && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Searching for contact information...</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/10">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Enrichment Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {enrichedData && !isEnriching && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">Found new information</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {enrichedData.source === 'hunter' ? 'Hunter.io' : 'People Data Labs'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {enrichedData.confidence}% confidence
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {[
                  { label: 'Email', original: originalData?.email, enriched: enrichedData.email },
                  { label: 'LinkedIn', original: originalData?.linkedinUrl, enriched: enrichedData.linkedinUrl },
                  { label: 'Title', original: originalData?.title, enriched: enrichedData.title },
                  { label: 'Company', original: originalData?.company, enriched: enrichedData.company },
                ].map((field) => {
                  const hasChange = field.original !== field.enriched && field.enriched;
                  if (!hasChange && !field.enriched) return null;
                  
                  return (
                    <div key={field.label} className="grid grid-cols-3 gap-4 text-sm">
                      <div className="font-medium text-muted-foreground">{field.label}</div>
                      <div className="col-span-2">
                        {hasChange ? (
                          <div className="space-y-1">
                            <div className="text-muted-foreground line-through">{field.original || 'Not set'}</div>
                            <div className="text-green-600 font-medium">{field.enriched}</div>
                          </div>
                        ) : (
                          <div>{field.enriched}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {enrichedData.extra && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Additional Information</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {enrichedData.extra.industry && (
                        <div>Industry: {enrichedData.extra.industry}</div>
                      )}
                      {enrichedData.extra.companySize && (
                        <div>Company Size: {enrichedData.extra.companySize}</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            data-testid="button-cancel-enrichment"
          >
            Cancel
          </Button>
          {enrichedData && hasChanges && (
            <Button
              onClick={handleSave}
              disabled={updateContact.isPending}
              data-testid="button-save-enrichment"
            >
              {updateContact.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          )}
          {enrichedData && !hasChanges && (
            <Button variant="secondary" onClick={() => handleOpenChange(false)}>
              No Changes to Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

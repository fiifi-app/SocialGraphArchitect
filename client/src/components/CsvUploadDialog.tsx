import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { enrichContact } from "@/lib/edgeFunctions";
import { queryClient } from "@/lib/queryClient";

interface CsvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedContact {
  name: string;
  email?: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  isLp?: boolean;
  errors: string[];
}

type UploadStage = 'upload' | 'parsing' | 'importing' | 'enriching' | 'complete';

export default function CsvUploadDialog({ open, onOpenChange }: CsvUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>('upload');
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    imported: 0,
    enriched: 0,
    failed: 0,
    enrichmentFailed: 0,
  });
  const { toast } = useToast();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateLinkedIn = (url: string): boolean => {
    return url.includes('linkedin.com/in/') || url.includes('linkedin.com/company/');
  };

  const normalizeLinkedInUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `https://linkedin.com/in/${url}`;
  };

  const parseCSV = useCallback((file: File) => {
    setStage('parsing');
    setProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsed: ParsedContact[] = results.data.map((row: any) => {
          const errors: string[] = [];
          
          // Extract and validate fields (flexible column name matching)
          const name = row.name || row.Name || row.full_name || row['Full Name'] || row.contact_name || '';
          const email = row.email || row.Email || row.email_address || '';
          const title = row.title || row.Title || row.position || row.Position || '';
          const company = row.company || row.Company || row.organization || row.Organization || '';
          const linkedin = row.linkedin || row.LinkedIn || row.linkedin_url || row['LinkedIn URL'] || '';
          const isLp = row.is_lp === 'true' || row.is_lp === '1' || row.type?.toLowerCase() === 'lp';

          // Validate required field
          if (!name || name.trim() === '') {
            errors.push('Missing name');
          }

          // Validate email format if provided
          if (email && !validateEmail(email)) {
            errors.push('Invalid email format');
          }

          // Validate LinkedIn URL if provided
          if (linkedin && !validateLinkedIn(linkedin)) {
            errors.push('Invalid LinkedIn URL');
          }

          return {
            name: name.trim(),
            email: email.trim() || undefined,
            title: title.trim() || undefined,
            company: company.trim() || undefined,
            linkedinUrl: linkedin ? normalizeLinkedInUrl(linkedin.trim()) : undefined,
            isLp: isLp || false,
            errors,
          };
        });

        setContacts(parsed);
        setStats({ ...stats, total: parsed.length });
        setProgress(100);
        
        toast({
          title: "CSV parsed successfully!",
          description: `Found ${parsed.length} contacts. ${parsed.filter(c => c.errors.length > 0).length} have validation warnings.`,
        });

        // Auto-start import
        await importContacts(parsed);
      },
      error: (error) => {
        toast({
          title: "Failed to parse CSV",
          description: error.message,
          variant: "destructive",
        });
        setStage('upload');
      },
    });
  }, []);

  const importContacts = async (contactsToImport: ParsedContact[]) => {
    setStage('importing');
    setProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication error",
        description: "Please log in to import contacts",
        variant: "destructive",
      });
      return;
    }

    // Batch insert contacts (Supabase handles up to 1000 at a time efficiently)
    const BATCH_SIZE = 500;
    let imported = 0;
    let failed = 0;
    const insertedContactIds: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < contactsToImport.length; i += BATCH_SIZE) {
      const batch = contactsToImport.slice(i, i + BATCH_SIZE);
      
      // Import ALL contacts, even with missing/invalid data
      const contactsData = batch
        .filter(c => c.name && c.name.trim().length > 0) // Only require name
        .map(c => {
          // Track validation warnings but still import
          if (c.errors.length > 0) {
            warnings.push(`${c.name}: ${c.errors.join(', ')}`);
          }
          
          // Only use core fields that exist in current Supabase schema
          // Note: is_lp and contact_type will be added after migration
          return {
            name: c.name,
            email: c.email || null,
            title: c.title || null,
            company: c.company || null,
            linkedin_url: c.linkedinUrl || null,
            owned_by_profile: user.id,
          };
        });

      try {
        const { data, error } = await supabase
          .from('contacts')
          .insert(contactsData)
          .select('id');

        if (error) throw error;
        
        imported += contactsData.length;
        if (data) {
          insertedContactIds.push(...data.map(c => c.id));
        }
      } catch (error: any) {
        console.error('Batch import error:', error);
        failed += batch.length;
      }

      setProgress(((i + batch.length) / contactsToImport.length) * 100);
      setStats(prev => ({ ...prev, imported, failed }));
    }

    const contactsWithoutName = contactsToImport.filter(c => !c.name || c.name.trim().length === 0).length;
    
    toast({
      title: "Contacts imported!",
      description: `Successfully imported ${imported} contacts. ${contactsWithoutName} skipped (no name). ${warnings.length} with validation warnings.`,
    });

    // Store warnings for display in complete stage
    if (warnings.length > 0) {
      console.log('Validation warnings:', warnings);
    }

    // Invalidate contacts cache
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });

    // Start enrichment for contacts with emails
    await enrichContacts(insertedContactIds);
  };

  const enrichContacts = async (contactIds: string[]) => {
    setStage('enriching');
    setProgress(0);

    // Only enrich contacts that have potential for enrichment
    const { data: contactsToEnrich } = await supabase
      .from('contacts')
      .select('id, email, name, company, linkedin_url')
      .in('id', contactIds)
      .or('email.not.is.null,linkedin_url.not.is.null,company.not.is.null');

    if (!contactsToEnrich || contactsToEnrich.length === 0) {
      setStage('complete');
      return;
    }

    let enriched = 0;
    let enrichmentFailed = 0;

    // Enrich with rate limiting (max 10 concurrent)
    const CONCURRENT_LIMIT = 10;
    
    for (let i = 0; i < contactsToEnrich.length; i += CONCURRENT_LIMIT) {
      const batch = contactsToEnrich.slice(i, i + CONCURRENT_LIMIT);
      
      const enrichmentPromises = batch.map(async (contact) => {
        try {
          await enrichContact(contact.id, 'auto');
          enriched++;
        } catch (error) {
          enrichmentFailed++;
        }
      });

      await Promise.allSettled(enrichmentPromises);

      setProgress(((i + batch.length) / contactsToEnrich.length) * 100);
      setStats(prev => ({ ...prev, enriched, enrichmentFailed }));

      // Rate limiting delay (avoid hitting API limits)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setStage('complete');
    queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });

    toast({
      title: "Enrichment complete!",
      description: `Enriched ${enriched} contacts. ${enrichmentFailed} could not be enriched.`,
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = () => {
    if (file) {
      parseCSV(file);
    }
  };

  const handleClose = () => {
    // Prevent closing during active operations
    if (stage !== 'upload' && stage !== 'complete') {
      toast({
        title: "Please wait",
        description: "Import in progress. Please wait until it completes.",
        variant: "destructive",
      });
      return;
    }
    
    setFile(null);
    setStage('upload');
    setContacts([]);
    setProgress(0);
    setStats({ total: 0, imported: 0, enriched: 0, failed: 0, enrichmentFailed: 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-csv-upload">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your contacts. We'll validate, import, and enrich them automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {stage === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                  data-testid="input-csv-file"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-2">
                    {file ? file.name : 'Click to select CSV file'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports: name, email, title, company, linkedin, type
                  </p>
                </label>
              </div>

              {file && (
                <Button
                  onClick={handleUpload}
                  className="w-full"
                  data-testid="button-start-import"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Import {file.name}
                </Button>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Expected CSV columns:</strong></p>
                <p>• name (required)</p>
                <p>• email, title, company, linkedin, is_lp (optional)</p>
                <p className="pt-2"><strong>What happens:</strong></p>
                <p>1. Parse and validate all contacts</p>
                <p>2. Import to database (even with missing data)</p>
                <p>3. Enrich with Hunter.io & People Data Labs</p>
                <p>4. Validate emails and LinkedIn URLs</p>
              </div>
            </div>
          )}

          {stage === 'parsing' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Parsing CSV file...</p>
                  <p className="text-sm text-muted-foreground">Reading and validating contacts</p>
                </div>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {stage === 'importing' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Importing contacts...</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.imported} of {stats.total} imported
                  </p>
                </div>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {stage === 'enriching' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                <div className="flex-1">
                  <p className="font-medium">Enriching contacts...</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.enriched} enriched, {stats.enrichmentFailed} failed
                  </p>
                </div>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">
                Fetching additional data from Hunter.io and People Data Labs...
              </p>
            </div>
          )}

          {stage === 'complete' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle2 className="w-8 h-8" />
                <div>
                  <p className="font-medium text-lg">Import complete!</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contacts</p>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Imported</p>
                  <p className="text-2xl font-semibold text-green-600">{stats.imported}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enriched</p>
                  <p className="text-2xl font-semibold text-blue-600">{stats.enriched}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-semibold text-red-600">
                    {stats.failed + stats.enrichmentFailed}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleClose}
                className="w-full"
                data-testid="button-close-import"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

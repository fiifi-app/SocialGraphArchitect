import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePipeline } from "@/contexts/PipelineContext";
import { LogOut, User, Bell, Shield, Calendar, CheckCircle2, BrainCircuit, Loader2, Play, Pause, RotateCcw, Mail, Search } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { extractThesis, researchContact, checkHunterStatus, runHunterBatch, checkBatchExtractionStatus, runBatchExtraction as runBatchExtractionApi } from "@/lib/edgeFunctions";
import { Globe } from "lucide-react";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  // Use pipeline context for background processing
  const {
    isPipelineRunning,
    isPipelinePaused,
    pipelineStage,
    enrichProgress,
    extractionProgress,
    currentBatch,
    totalBatches,
    startPipeline,
    pauseResumePipeline,
    stopPipeline,
  } = usePipeline();
  
  // Legacy state for standalone thesis extraction (separate from pipeline)
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [legacyExtractionProgress, setLegacyExtractionProgress] = useState({ processed: 0, total: 0, succeeded: 0, failed: 0 });
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  
  // Server-side batch extraction state
  const [isServerExtracting, setIsServerExtracting] = useState(false);
  const [serverProgress, setServerProgress] = useState<{ lastBatch: number; remaining: number } | null>(null);
  const serverAbortRef = useRef(false);
  
  // Hunter.io email finding state
  const [isHunterProcessing, setIsHunterProcessing] = useState(false);
  const [hunterResults, setHunterResults] = useState<{ processed: number; successful: number } | null>(null);

  // Check for Google Calendar connection success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') {
      toast({
        title: "Google Calendar Connected",
        description: "Your calendar events will now sync automatically.",
      });
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
      // Trigger sync
      queryClient.invalidateQueries({ queryKey: ['/user-preferences'] });
    }
  }, [location, toast, queryClient]);

  // Fetch user preferences to check Google Calendar connection status
  const { data: preferences } = useQuery<{google_calendar_connected: boolean} | null>({
    queryKey: ['/user-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('google_calendar_connected')
        .eq('profile_id', user.id)
        .single();
      
      if (error) throw error;
      return (data as {google_calendar_connected: boolean}) || null;
    },
    enabled: !!user,
  });

  // Query Hunter.io status
  const { data: hunterStatus, refetch: refetchHunterStatus, isLoading: isHunterLoading, error: hunterError } = useQuery({
    queryKey: ['/hunter-status'],
    queryFn: async () => {
      try {
        return await checkHunterStatus();
      } catch (e: any) {
        // Return null if not configured instead of throwing
        if (e?.message?.includes('not configured')) {
          return null;
        }
        throw e;
      }
    },
    enabled: !!user,
    retry: false,
  });
  
  const handleRunHunter = async (limit: number = 1) => {
    setIsHunterProcessing(true);
    setHunterResults(null);
    try {
      const result = await runHunterBatch(limit);
      setHunterResults({ 
        processed: result.processed, 
        successful: result.successful 
      });
      toast({
        title: "Hunter.io Processing Complete",
        description: `Found ${result.successful} emails out of ${result.processed} contacts`,
      });
      refetchHunterStatus();
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    } catch (error: any) {
      toast({
        title: "Hunter.io Error",
        description: error?.message || "Failed to process contacts",
        variant: "destructive",
      });
    } finally {
      setIsHunterProcessing(false);
    }
  };

  // Query to count contacts needing thesis extraction
  const { data: thesisStats, refetch: refetchThesisStats } = useQuery({
    queryKey: ['/thesis-extraction-stats'],
    queryFn: async () => {
      // Count total contacts with bio, title, or investor_notes
      const { count: eligibleCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .or('bio.not.is.null,title.not.is.null,investor_notes.not.is.null');
      
      // Count contacts that already have thesis data
      const { count: withThesisCount } = await supabase
        .from('theses')
        .select('*', { count: 'exact', head: true });
      
      // Total contacts
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });
      
      return {
        total: totalContacts || 0,
        eligible: eligibleCount || 0,
        withThesis: withThesisCount || 0,
        needsExtraction: (eligibleCount || 0) - (withThesisCount || 0),
      };
    },
    enabled: !!user,
  });
  
  // Query to count contacts needing bio enrichment (have name but missing bio/title/investor_notes)
  const { data: enrichStats, refetch: refetchEnrichStats } = useQuery({
    queryKey: ['/enrich-stats'],
    queryFn: async () => {
      // Total contacts
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });
      
      // Contacts with name (eligible for research)
      const { count: withName } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .not('name', 'is', null)
        .neq('name', '');
      
      // Contacts already enriched (have bio or investor_notes with content)
      const { count: enrichedCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .or('bio.not.is.null,investor_notes.not.is.null');
      
      return {
        total: totalContacts || 0,
        withName: withName || 0,
        enriched: enrichedCount || 0,
        needsEnrichment: (withName || 0) - (enrichedCount || 0),
      };
    },
    enabled: !!user,
  });
  
  // Helper to fetch all rows with pagination
  const fetchAllContacts = async () => {
    const allContacts: any[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, bio, title, investor_notes')
        .or('bio.not.is.null,title.not.is.null,investor_notes.not.is.null')
        .range(from, from + PAGE_SIZE - 1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allContacts.push(...data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    
    return allContacts;
  };
  
  const fetchAllThesisIds = async () => {
    const allIds: string[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('theses')
        .select('contact_id')
        .range(from, from + PAGE_SIZE - 1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allIds.push(...data.map((t: { contact_id: string }) => t.contact_id));
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    
    return new Set(allIds);
  };
  
  // Batch thesis extraction function
  const runBatchExtraction = useCallback(async () => {
    setIsExtracting(true);
    setIsPaused(false);
    pausedRef.current = false;
    abortRef.current = false;
    
    try {
      toast({ title: "Loading contacts...", description: "Fetching all contacts for processing" });
      
      // Fetch all contacts with pagination
      const [eligibleContacts, thesisContactIds] = await Promise.all([
        fetchAllContacts(),
        fetchAllThesisIds()
      ]);
      
      if (!eligibleContacts || eligibleContacts.length === 0) {
        toast({ title: "No contacts found", variant: "destructive" });
        setIsExtracting(false);
        return;
      }
      
      // Filter to only contacts without thesis
      const contactsToProcess = eligibleContacts.filter(c => 
        !thesisContactIds.has(c.id) &&
        ((c.bio && c.bio.trim().length > 0) || 
         (c.title && c.title.trim().length > 0) || 
         (c.investor_notes && c.investor_notes.trim().length > 0))
      );
      
      const total = contactsToProcess.length;
      setLegacyExtractionProgress({ processed: 0, total, succeeded: 0, failed: 0 });
      
      if (total === 0) {
        toast({ title: "All contacts already have thesis data" });
        setIsExtracting(false);
        return;
      }
      
      toast({ 
        title: "Starting thesis extraction", 
        description: `Processing ${total} contacts...` 
      });
      
      let succeeded = 0;
      let failed = 0;
      let processed = 0;
      
      // Process in batches of 5 with delays
      const BATCH_SIZE = 5;
      const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches
      
      let wasStopped = false;
      
      for (let i = 0; i < contactsToProcess.length; i += BATCH_SIZE) {
        // Check if aborted before starting batch
        if (abortRef.current) {
          wasStopped = true;
          break;
        }
        
        // Wait while paused
        while (pausedRef.current && !abortRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check again after resume
        if (abortRef.current) {
          wasStopped = true;
          break;
        }
        
        const batch = contactsToProcess.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel and wait for all to complete
        const results = await Promise.allSettled(
          batch.map(async (contact) => {
            try {
              await extractThesis(contact.id);
              return { success: true, name: contact.name };
            } catch (error) {
              console.error(`Failed to extract thesis for ${contact.name}:`, error);
              return { success: false, name: contact.name };
            }
          })
        );
        
        // Count results - increment per contact
        results.forEach((result) => {
          processed++;
          if (result.status === 'fulfilled' && result.value.success) {
            succeeded++;
          } else {
            failed++;
          }
        });
        
        setLegacyExtractionProgress({ 
          processed, 
          total, 
          succeeded, 
          failed 
        });
        
        // Rate limiting delay
        if (i + BATCH_SIZE < contactsToProcess.length && !abortRef.current) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }
      
      setIsExtracting(false);
      refetchThesisStats();
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      
      if (wasStopped) {
        toast({ 
          title: "Extraction stopped", 
          description: `Processed ${processed} of ${total}. ${succeeded} succeeded, ${failed} failed. ${total - processed} remaining.` 
        });
      } else {
        toast({ 
          title: "Thesis extraction complete!", 
          description: `Extracted ${succeeded} theses. ${failed} failed.` 
        });
      }
      
    } catch (error) {
      console.error('Batch extraction error:', error);
      toast({ 
        title: "Extraction error", 
        description: String(error), 
        variant: "destructive" 
      });
      setIsExtracting(false);
    }
  }, [toast, refetchThesisStats, queryClient]);
  
  const handlePauseResume = () => {
    pausedRef.current = !pausedRef.current;
    setIsPaused(pausedRef.current);
  };
  
  const handleStop = () => {
    abortRef.current = true;
    pausedRef.current = false;
    setIsPaused(false);
  };
  
  // Fetch all contacts for enrichment (ALL contacts with names)
  const fetchAllContactsForEnrichment = async () => {
    const allContacts: any[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, company, company_url, email, title, bio, investor_notes, contact_type, is_investor')
        .neq('name', null)
        .neq('name', '')
        .range(from, from + PAGE_SIZE - 1);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        allContacts.push(...data);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    
    return allContacts;
  };
  
  
  // Run thesis extraction on ALL contacts (not just ones missing thesis)
  const runBatchThesisExtractionAll = useCallback(async () => {
    setIsExtracting(true);
    setIsPaused(false);
    pausedRef.current = false;
    abortRef.current = false;
    
    try {
      toast({ title: "Loading all contacts...", description: "Fetching all contacts for thesis extraction" });
      
      // Fetch ALL contacts with any text content
      const allContacts = await fetchAllContactsForEnrichment();
      
      // Filter to only contacts with some text to analyze
      const contactsToProcess = allContacts.filter(c => 
        (c.bio && c.bio.trim().length > 0) || 
        (c.title && c.title.trim().length > 0) || 
        (c.investor_notes && c.investor_notes.trim().length > 0)
      );
      
      const total = contactsToProcess.length;
      setLegacyExtractionProgress({ processed: 0, total, succeeded: 0, failed: 0 });
      
      if (total === 0) {
        toast({ title: "No contacts with data to extract thesis from" });
        setIsExtracting(false);
        return;
      }
      
      toast({ 
        title: "Starting thesis extraction on ALL contacts", 
        description: `Processing ${total.toLocaleString()} contacts...` 
      });
      
      let succeeded = 0;
      let failed = 0;
      let processed = 0;
      
      const BATCH_SIZE = 5;
      const DELAY_BETWEEN_BATCHES = 2000;
      
      let wasStopped = false;
      
      for (let i = 0; i < contactsToProcess.length; i += BATCH_SIZE) {
        if (abortRef.current) {
          wasStopped = true;
          break;
        }
        
        while (pausedRef.current && !abortRef.current) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (abortRef.current) {
          wasStopped = true;
          break;
        }
        
        const batch = contactsToProcess.slice(i, i + BATCH_SIZE);
        
        const results = await Promise.allSettled(
          batch.map(async (contact) => {
            try {
              await extractThesis(contact.id);
              return { success: true, name: contact.name };
            } catch (error) {
              console.error(`Failed to extract thesis for ${contact.name}:`, error);
              return { success: false, name: contact.name };
            }
          })
        );
        
        results.forEach((result) => {
          processed++;
          if (result.status === 'fulfilled' && result.value.success) {
            succeeded++;
          } else {
            failed++;
          }
        });
        
        setLegacyExtractionProgress({ 
          processed, 
          total, 
          succeeded, 
          failed 
        });
        
        if (i + BATCH_SIZE < contactsToProcess.length && !abortRef.current) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }
      
      setIsExtracting(false);
      refetchThesisStats();
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      
      if (wasStopped) {
        toast({ 
          title: "Extraction stopped", 
          description: `Processed ${processed} of ${total}. ${succeeded} succeeded, ${failed} failed.` 
        });
      } else {
        toast({ 
          title: "Thesis extraction complete!", 
          description: `Extracted ${succeeded} theses from ALL contacts. ${failed} failed.` 
        });
      }
      
    } catch (error) {
      console.error('Batch extraction error:', error);
      toast({ 
        title: "Extraction error", 
        description: String(error), 
        variant: "destructive" 
      });
      setIsExtracting(false);
    }
  }, [toast, refetchThesisStats, queryClient]);
  
  
  // Server-side batch extraction - continues even if page is refreshed
  const runServerBatchExtraction = useCallback(async () => {
    setIsServerExtracting(true);
    serverAbortRef.current = false;
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    
    try {
      toast({ 
        title: "Starting server-side extraction", 
        description: "Processing batches of 25 contacts..." 
      });
      
      // Keep processing batches until done or stopped
      while (!serverAbortRef.current) {
        const result = await runBatchExtractionApi(25);
        
        if (result.message) {
          // All done
          toast({ 
            title: "Extraction complete!", 
            description: result.message 
          });
          break;
        }
        
        totalProcessed += result.processed;
        totalSucceeded += result.succeeded;
        totalFailed += result.failed;
        
        setServerProgress({ 
          lastBatch: result.succeeded, 
          remaining: result.remaining 
        });
        
        // If no more to process, we're done
        if (result.remaining === 0) {
          toast({ 
            title: "Extraction complete!", 
            description: `Processed ${totalProcessed} contacts. ${totalSucceeded} succeeded, ${totalFailed} failed.` 
          });
          break;
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (serverAbortRef.current) {
        toast({ 
          title: "Extraction paused", 
          description: `Processed ${totalProcessed} contacts so far. Click "Continue" to resume.` 
        });
      }
      
    } catch (error: any) {
      console.error('Server extraction error:', error);
      toast({ 
        title: "Extraction error", 
        description: error?.message || "Failed to process batch", 
        variant: "destructive" 
      });
    } finally {
      setIsServerExtracting(false);
      refetchThesisStats();
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    }
  }, [toast, refetchThesisStats, queryClient]);
  
  const handleStopServerExtraction = () => {
    serverAbortRef.current = true;
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to disconnect');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Calendar Disconnected",
        description: "Google Calendar has been disconnected from your account.",
      });
      queryClient.invalidateQueries({ queryKey: ['/user-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['/calendar-events/today'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect Google Calendar. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await signOut();
  };

  const handleConnectCalendar = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Error",
        description: "No active session. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    // Redirect with Authorization header via fetch then redirect
    window.location.href = `/api/auth/google/connect?token=${encodeURIComponent(session.access_token)}`;
  };

  const handleDisconnectCalendar = () => {
    disconnectMutation.mutate();
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-3">Settings</h1>
        <p className="text-muted-foreground text-base">
          Manage your account preferences and settings
        </p>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Account</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <p className="text-base" data-testid="text-user-email">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">User ID</label>
              <p className="text-base text-muted-foreground text-xs font-mono" data-testid="text-user-id">
                {user?.id}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Google Calendar Integration</h2>
          </div>
          {preferences?.google_calendar_connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Connected to Google Calendar</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your calendar events sync automatically. Upcoming meetings will appear on your home page with push notifications.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectCalendar}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect-calendar"
              >
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect Calendar"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Google Calendar to automatically sync upcoming meetings and receive push notifications before they start.
              </p>
              <Button
                size="sm"
                onClick={handleConnectCalendar}
                data-testid="button-connect-calendar"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Connect Google Calendar
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Contact Intelligence Pipeline</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Run a complete AI analysis on all contacts: Step 1) AI researches bio/title and investor info, Step 2) Extracts investment thesis keywords. This combines enrichment and thesis extraction into one workflow.
            </p>
            
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-md text-sm text-indigo-700 dark:text-indigo-300">
              <strong>Unified Pipeline:</strong> {pipelineStage === 'enrichment' ? '📝 Step 1: AI Research' : '🧠 Step 2: Thesis Extraction'}
            </div>
            
            {enrichStats && thesisStats && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total contacts:</span>
                  <span className="ml-2 font-medium">{enrichStats.total.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Need enrichment:</span>
                  <span className="ml-2 font-medium text-amber-600">{enrichStats.needsEnrichment.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Enriched:</span>
                  <span className="ml-2 font-medium text-green-600">{enrichStats.enriched.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">With thesis:</span>
                  <span className="ml-2 font-medium text-green-600">{thesisStats.withThesis.toLocaleString()}</span>
                </div>
              </div>
            )}
            
            {isPipelineRunning && (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Batch {currentBatch}/{totalBatches} - Processing in background (you can navigate away)
                </div>
                {pipelineStage === 'enrichment' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isPipelinePaused ? 'Paused' : 'Enriching contacts...'}
                      </span>
                      <span className="text-muted-foreground">
                        {enrichProgress.processed} / {enrichProgress.total}
                      </span>
                    </div>
                    <Progress value={(enrichProgress.processed / Math.max(enrichProgress.total, 1)) * 100} className="h-2" />
                  </div>
                )}
                
                {pipelineStage === 'extraction' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isPipelinePaused ? 'Paused' : 'Extracting thesis...'}
                      </span>
                      <span className="text-muted-foreground">
                        {extractionProgress.processed} / {extractionProgress.total}
                      </span>
                    </div>
                    <Progress value={(extractionProgress.processed / Math.max(extractionProgress.total, 1)) * 100} className="h-2" />
                  </div>
                )}
              </div>
            )}
            
            <div className="flex flex-wrap gap-2">
              {!isPipelineRunning ? (
                <>
                  <Button
                    size="sm"
                    onClick={startPipeline}
                    disabled={!enrichStats || enrichStats.withName === 0}
                    data-testid="button-start-pipeline"
                  >
                    <BrainCircuit className="w-4 h-4 mr-2" />
                    Start Pipeline ({enrichStats?.withName.toLocaleString() || 0} contacts)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { refetchEnrichStats(); refetchThesisStats(); }}
                    data-testid="button-refresh-pipeline-stats"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={pauseResumePipeline}
                    data-testid="button-pause-pipeline"
                  >
                    {isPipelinePaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                    {isPipelinePaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={stopPipeline}
                    data-testid="button-stop-pipeline"
                  >
                    Stop
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Hunter.io Email Finding</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Find email addresses for contacts using Hunter.io. Free tier: 25 searches/month.
              Run after thesis extraction completes for best results.
            </p>
            
            {isHunterLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking Hunter.io status...
              </div>
            ) : hunterStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Searches used:</span>
                    <span className="ml-2 font-medium">
                      {hunterStatus.account.searches.used} / {hunterStatus.account.searches.available}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remaining:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {hunterStatus.account.searches.available - hunterStatus.account.searches.used}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contacts without email:</span>
                    <span className="ml-2 font-medium text-amber-600">{hunterStatus.pending}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Verifications:</span>
                    <span className="ml-2 font-medium">
                      {hunterStatus.account.verifications.used} / {hunterStatus.account.verifications.available}
                    </span>
                  </div>
                </div>
                
                {hunterResults && (
                  <div className="p-3 bg-muted/50 rounded-md text-sm">
                    Last run: Found {hunterResults.successful} emails from {hunterResults.processed} contacts
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleRunHunter(1)}
                    disabled={isHunterProcessing || hunterStatus.account.searches.available - hunterStatus.account.searches.used <= 0}
                    data-testid="button-hunter-1"
                  >
                    {isHunterProcessing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 mr-2" />
                    )}
                    Find 1 Email
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunHunter(5)}
                    disabled={isHunterProcessing || hunterStatus.account.searches.available - hunterStatus.account.searches.used < 5}
                    data-testid="button-hunter-5"
                  >
                    Find 5 Emails
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunHunter(Math.min(hunterStatus.account.searches.available - hunterStatus.account.searches.used, hunterStatus.pending))}
                    disabled={isHunterProcessing || hunterStatus.account.searches.available - hunterStatus.account.searches.used <= 0}
                    data-testid="button-hunter-all"
                  >
                    Use All Credits ({hunterStatus.account.searches.available - hunterStatus.account.searches.used})
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Tip: Run 1 contact per day to maximize free tier. Credits reset monthly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 border border-dashed rounded-md">
                  <p className="text-sm font-medium mb-2">Hunter.io API key not configured</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    To enable email finding, add your Hunter.io API key to your Supabase Edge Function secrets:
                  </p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Go to <a href="https://hunter.io/api-keys" target="_blank" rel="noopener" className="text-primary underline">hunter.io/api-keys</a> (free signup)</li>
                    <li>Copy your API key</li>
                    <li>In Supabase Dashboard → Settings → Edge Functions → Secrets</li>
                    <li>Add secret: <code className="bg-muted px-1 rounded">HUNTER_API_KEY</code></li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchHunterStatus()}
                  data-testid="button-hunter-refresh"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Check Again
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Notifications</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Browser notifications are automatically enabled for upcoming calendar events.
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Privacy & Security</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Privacy settings will be available soon
          </p>
        </Card>

        <Separator />

        <Card className="p-6 border-destructive/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-1">Sign Out</h2>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

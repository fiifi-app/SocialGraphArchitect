import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Bell, Shield, Calendar, CheckCircle2, BrainCircuit, Loader2, Play, Pause, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { extractThesis } from "@/lib/edgeFunctions";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  // Batch thesis extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState({ processed: 0, total: 0, succeeded: 0, failed: 0 });
  const pausedRef = useRef(false);
  const abortRef = useRef(false);

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
        allIds.push(...data.map(t => t.contact_id));
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
      setExtractionProgress({ processed: 0, total, succeeded: 0, failed: 0 });
      
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
        
        setExtractionProgress({ 
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
    <div className="p-8 max-w-4xl mx-auto">
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
            <h2 className="text-xl font-semibold">AI Thesis Extraction</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Extract investment thesis keywords from your contacts using AI. This analyzes bio, title, and investor notes to identify sectors, stages, check sizes, and geographic focus.
            </p>
            
            {thesisStats && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total contacts:</span>
                  <span className="ml-2 font-medium">{thesisStats.total.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">With thesis data:</span>
                  <span className="ml-2 font-medium text-green-600">{thesisStats.withThesis.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Eligible for extraction:</span>
                  <span className="ml-2 font-medium">{thesisStats.eligible.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pending extraction:</span>
                  <span className="ml-2 font-medium text-amber-600">{thesisStats.needsExtraction.toLocaleString()}</span>
                </div>
              </div>
            )}
            
            {isExtracting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {isPaused ? 'Paused' : 'Processing...'} {extractionProgress.processed} of {extractionProgress.total}
                  </span>
                  <span className="text-muted-foreground">
                    {extractionProgress.succeeded} succeeded, {extractionProgress.failed} failed
                  </span>
                </div>
                <Progress 
                  value={(extractionProgress.processed / Math.max(extractionProgress.total, 1)) * 100} 
                  className="h-2"
                />
              </div>
            )}
            
            <div className="flex gap-2">
              {!isExtracting ? (
                <Button
                  size="sm"
                  onClick={runBatchExtraction}
                  disabled={!thesisStats || thesisStats.needsExtraction === 0}
                  data-testid="button-start-extraction"
                >
                  <BrainCircuit className="w-4 h-4 mr-2" />
                  Extract Thesis for {thesisStats?.needsExtraction.toLocaleString() || 0} Contacts
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePauseResume}
                    data-testid="button-pause-extraction"
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleStop}
                    data-testid="button-stop-extraction"
                  >
                    Stop
                  </Button>
                </>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Estimated time: ~{Math.ceil((thesisStats?.needsExtraction || 0) / 5 * 2 / 60)} minutes. 
              Cost: ~${((thesisStats?.needsExtraction || 0) * 0.0003).toFixed(2)} (GPT-4o-mini)
            </p>
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

import { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { researchContact, extractThesis } from '@/lib/edgeFunctions';

interface PipelineProgress {
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
}

interface PipelineState {
  contactIds: string[];
  processedIds: string[];
  totalContacts: number;
  enrichSucceeded: number;
  enrichFailed: number;
  thesisSucceeded: number;
  thesisFailed: number;
  currentIndex: number;
}

interface PipelineContextType {
  isPipelineRunning: boolean;
  isPipelinePaused: boolean;
  pipelineStage: 'enrichment' | 'extraction';
  enrichProgress: PipelineProgress;
  extractionProgress: PipelineProgress;
  currentBatch: number;
  totalBatches: number;
  startPipeline: () => Promise<void>;
  resumePipeline: () => Promise<void>;
  pauseResumePipeline: () => void;
  stopPipeline: () => void;
  hasInterruptedPipeline: boolean;
}

const PIPELINE_STATE_KEY = 'pipeline_state';

const PipelineContext = createContext<PipelineContextType | null>(null);

export function usePipeline() {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error('usePipeline must be used within a PipelineProvider');
  }
  return context;
}

function savePipelineState(state: PipelineState | null) {
  if (state) {
    localStorage.setItem(PIPELINE_STATE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(PIPELINE_STATE_KEY);
  }
}

function loadPipelineState(): PipelineState | null {
  try {
    const saved = localStorage.getItem(PIPELINE_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load pipeline state:', e);
  }
  return null;
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [isPipelinePaused, setIsPipelinePaused] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<'enrichment' | 'extraction'>('enrichment');
  const [enrichProgress, setEnrichProgress] = useState<PipelineProgress>({ processed: 0, total: 0, succeeded: 0, failed: 0 });
  const [extractionProgress, setExtractionProgress] = useState<PipelineProgress>({ processed: 0, total: 0, succeeded: 0, failed: 0 });
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [hasInterruptedPipeline, setHasInterruptedPipeline] = useState(false);
  
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const stateRef = useRef<PipelineState | null>(null);

  useEffect(() => {
    const savedState = loadPipelineState();
    if (savedState && savedState.contactIds.length > savedState.processedIds.length) {
      setHasInterruptedPipeline(true);
      const remaining = savedState.contactIds.length - savedState.processedIds.length;
      setEnrichProgress({
        processed: savedState.processedIds.length,
        total: savedState.totalContacts,
        succeeded: savedState.enrichSucceeded,
        failed: savedState.enrichFailed
      });
      setExtractionProgress({
        processed: savedState.processedIds.length,
        total: savedState.totalContacts,
        succeeded: savedState.thesisSucceeded,
        failed: savedState.thesisFailed
      });
      console.log(`[Pipeline] Found interrupted pipeline with ${remaining} contacts remaining`);
    }
  }, []);

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

  const runPipeline = useCallback(async (contacts: any[], startIndex: number = 0, initialState?: PipelineState) => {
    const BATCH_SIZE = 3;
    const BATCH_DELAY = 3000;
    const totalContacts = contacts.length;
    const batchCount = Math.ceil(totalContacts / BATCH_SIZE);
    
    setTotalBatches(batchCount);
    
    let state: PipelineState = initialState || {
      contactIds: contacts.map(c => c.id),
      processedIds: [],
      totalContacts,
      enrichSucceeded: 0,
      enrichFailed: 0,
      thesisSucceeded: 0,
      thesisFailed: 0,
      currentIndex: startIndex
    };
    stateRef.current = state;
    
    for (let i = startIndex; i < contacts.length; i += BATCH_SIZE) {
      if (abortRef.current) break;
      while (pausedRef.current && !abortRef.current) await new Promise(resolve => setTimeout(resolve, 500));
      if (abortRef.current) break;
      
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      setCurrentBatch(batchNumber);
      
      setPipelineStage('enrichment');
      
      const enrichResults = await Promise.allSettled(
        batch.map(async (contact) => {
          try {
            const result = await researchContact(contact.id);
            return { 
              id: contact.id,
              processed: result.success, 
              updated: result.success && result.updated, 
              name: contact.name 
            };
          } catch (error) {
            console.error(`Failed to research ${contact.name}:`, error);
            return { id: contact.id, processed: false, updated: false, name: contact.name };
          }
        })
      );
      
      let batchEnrichSucceeded = 0, batchEnrichFailed = 0;
      enrichResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.processed) batchEnrichSucceeded++;
        else batchEnrichFailed++;
      });
      
      state.enrichSucceeded += batchEnrichSucceeded;
      state.enrichFailed += batchEnrichFailed;
      
      setEnrichProgress({ 
        processed: i + batch.length, 
        total: totalContacts, 
        succeeded: state.enrichSucceeded, 
        failed: state.enrichFailed 
      });
      
      setPipelineStage('extraction');
      
      const contactsForThesis = batch.filter(c => 
        (c.bio && c.bio.trim().length > 0) || 
        (c.title && c.title.trim().length > 0) || 
        (c.investor_notes && c.investor_notes.trim().length > 0)
      );
      
      if (contactsForThesis.length > 0) {
        const thesisResults = await Promise.allSettled(
          contactsForThesis.map(async (contact) => {
            try {
              await extractThesis(contact.id);
              return { success: true, name: contact.name };
            } catch (error) {
              console.error(`Failed to extract thesis for ${contact.name}:`, error);
              return { success: false, name: contact.name };
            }
          })
        );
        
        let batchThesisSucceeded = 0, batchThesisFailed = 0;
        thesisResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.success) batchThesisSucceeded++;
          else batchThesisFailed++;
        });
        
        state.thesisSucceeded += batchThesisSucceeded;
        state.thesisFailed += batchThesisFailed;
      }
      
      setExtractionProgress({ 
        processed: i + batch.length, 
        total: totalContacts, 
        succeeded: state.thesisSucceeded, 
        failed: state.thesisFailed 
      });
      
      batch.forEach(c => state.processedIds.push(c.id));
      state.currentIndex = i + BATCH_SIZE;
      savePipelineState(state);
      
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/enrich-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/thesis-extraction-stats'] });
      
      if (i + BATCH_SIZE < contacts.length && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    return state;
  }, [queryClient]);

  const startPipeline = useCallback(async () => {
    if (isPipelineRunning) {
      toast({ title: "Pipeline already running", variant: "destructive" });
      return;
    }
    
    savePipelineState(null);
    setHasInterruptedPipeline(false);
    
    setIsPipelineRunning(true);
    setIsPipelinePaused(false);
    pausedRef.current = false;
    abortRef.current = false;
    setEnrichProgress({ processed: 0, total: 0, succeeded: 0, failed: 0 });
    setExtractionProgress({ processed: 0, total: 0, succeeded: 0, failed: 0 });
    
    try {
      toast({ title: "Starting Contact Intelligence Pipeline", description: "Processing contacts in batches..." });
      
      const allContacts = await fetchAllContactsForEnrichment();
      
      if (!allContacts || allContacts.length === 0) {
        toast({ title: "No contacts found", variant: "destructive" });
        setIsPipelineRunning(false);
        return;
      }
      
      setEnrichProgress({ processed: 0, total: allContacts.length, succeeded: 0, failed: 0 });
      setExtractionProgress({ processed: 0, total: allContacts.length, succeeded: 0, failed: 0 });
      
      const finalState = await runPipeline(allContacts);
      
      setIsPipelineRunning(false);
      setCurrentBatch(0);
      savePipelineState(null);
      setHasInterruptedPipeline(false);
      
      if (abortRef.current) {
        toast({ 
          title: "Pipeline stopped", 
          description: `Processed: ${finalState.processedIds.length}/${finalState.totalContacts}. Thesis: ${finalState.thesisSucceeded}.` 
        });
      } else {
        toast({ 
          title: "Contact Intelligence Pipeline Complete!", 
          description: `Processed ${finalState.processedIds.length}/${finalState.totalContacts} contacts. Extracted thesis for ${finalState.thesisSucceeded}.` 
        });
      }
      
    } catch (error) {
      console.error('Pipeline error:', error);
      toast({ title: "Pipeline error", description: String(error), variant: "destructive" });
      setIsPipelineRunning(false);
    }
  }, [isPipelineRunning, toast, runPipeline]);

  const resumePipeline = useCallback(async () => {
    if (isPipelineRunning) {
      toast({ title: "Pipeline already running", variant: "destructive" });
      return;
    }
    
    const savedState = loadPipelineState();
    if (!savedState || savedState.contactIds.length === savedState.processedIds.length) {
      toast({ title: "No interrupted pipeline found", variant: "destructive" });
      return;
    }
    
    setIsPipelineRunning(true);
    setIsPipelinePaused(false);
    pausedRef.current = false;
    abortRef.current = false;
    
    try {
      const remainingIds = savedState.contactIds.filter(id => !savedState.processedIds.includes(id));
      toast({ 
        title: "Resuming Pipeline", 
        description: `Continuing with ${remainingIds.length} remaining contacts...` 
      });
      
      const { data: remainingContacts, error } = await supabase
        .from('contacts')
        .select('id, name, company, company_url, email, title, bio, investor_notes, contact_type, is_investor')
        .in('id', remainingIds) as { data: any[] | null; error: any };
      
      if (error) throw error;
      if (!remainingContacts || remainingContacts.length === 0) {
        toast({ title: "No remaining contacts found", variant: "destructive" });
        setIsPipelineRunning(false);
        savePipelineState(null);
        setHasInterruptedPipeline(false);
        return;
      }
      
      setEnrichProgress({
        processed: savedState.processedIds.length,
        total: savedState.totalContacts,
        succeeded: savedState.enrichSucceeded,
        failed: savedState.enrichFailed
      });
      setExtractionProgress({
        processed: savedState.processedIds.length,
        total: savedState.totalContacts,
        succeeded: savedState.thesisSucceeded,
        failed: savedState.thesisFailed
      });
      
      const resumeState: PipelineState = {
        ...savedState,
        contactIds: [...savedState.processedIds, ...remainingContacts.map(c => c.id)]
      };
      
      const finalState = await runPipeline(remainingContacts, 0, resumeState);
      
      setIsPipelineRunning(false);
      setCurrentBatch(0);
      savePipelineState(null);
      setHasInterruptedPipeline(false);
      
      if (abortRef.current) {
        toast({ 
          title: "Pipeline stopped", 
          description: `Processed: ${finalState.processedIds.length}/${finalState.totalContacts}. Thesis: ${finalState.thesisSucceeded}.` 
        });
      } else {
        toast({ 
          title: "Contact Intelligence Pipeline Complete!", 
          description: `Processed ${finalState.processedIds.length}/${finalState.totalContacts} contacts. Extracted thesis for ${finalState.thesisSucceeded}.` 
        });
      }
      
    } catch (error) {
      console.error('Resume pipeline error:', error);
      toast({ title: "Resume error", description: String(error), variant: "destructive" });
      setIsPipelineRunning(false);
    }
  }, [isPipelineRunning, toast, runPipeline]);

  const pauseResumePipeline = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setIsPipelinePaused(pausedRef.current);
  }, []);

  const stopPipeline = useCallback(() => {
    abortRef.current = true;
    pausedRef.current = false;
    setIsPipelinePaused(false);
  }, []);

  return (
    <PipelineContext.Provider value={{
      isPipelineRunning,
      isPipelinePaused,
      pipelineStage,
      enrichProgress,
      extractionProgress,
      currentBatch,
      totalBatches,
      startPipeline,
      resumePipeline,
      pauseResumePipeline,
      stopPipeline,
      hasInterruptedPipeline,
    }}>
      {children}
    </PipelineContext.Provider>
  );
}

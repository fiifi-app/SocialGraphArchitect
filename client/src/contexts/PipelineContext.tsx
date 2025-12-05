import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
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

interface PipelineContextType {
  isPipelineRunning: boolean;
  isPipelinePaused: boolean;
  pipelineStage: 'enrichment' | 'extraction';
  enrichProgress: PipelineProgress;
  extractionProgress: PipelineProgress;
  currentBatch: number;
  totalBatches: number;
  startPipeline: () => Promise<void>;
  pauseResumePipeline: () => void;
  stopPipeline: () => void;
}

const PipelineContext = createContext<PipelineContextType | null>(null);

export function usePipeline() {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error('usePipeline must be used within a PipelineProvider');
  }
  return context;
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
  
  const pausedRef = useRef(false);
  const abortRef = useRef(false);

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

  const startPipeline = useCallback(async () => {
    if (isPipelineRunning) {
      toast({ title: "Pipeline already running", variant: "destructive" });
      return;
    }
    
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
      
      const totalContacts = allContacts.length;
      let totalEnrichSucceeded = 0, totalEnrichFailed = 0;
      let totalThesisSucceeded = 0, totalThesisFailed = 0;
      
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 3000;
      const batchCount = Math.ceil(allContacts.length / BATCH_SIZE);
      setTotalBatches(batchCount);
      
      for (let i = 0; i < allContacts.length; i += BATCH_SIZE) {
        if (abortRef.current) break;
        while (pausedRef.current && !abortRef.current) await new Promise(resolve => setTimeout(resolve, 500));
        if (abortRef.current) break;
        
        const batch = allContacts.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        setCurrentBatch(batchNumber);
        
        setPipelineStage('enrichment');
        
        const enrichResults = await Promise.allSettled(
          batch.map(async (contact) => {
            try {
              const result = await researchContact(contact.id);
              return { 
                processed: result.success, 
                updated: result.success && result.updated, 
                name: contact.name 
              };
            } catch (error) {
              console.error(`Failed to research ${contact.name}:`, error);
              return { processed: false, updated: false, name: contact.name };
            }
          })
        );
        
        let batchEnrichSucceeded = 0, batchEnrichFailed = 0;
        enrichResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.processed) batchEnrichSucceeded++;
          else batchEnrichFailed++;
        });
        
        totalEnrichSucceeded += batchEnrichSucceeded;
        totalEnrichFailed += batchEnrichFailed;
        
        setEnrichProgress({ 
          processed: i + batch.length, 
          total: totalContacts, 
          succeeded: totalEnrichSucceeded, 
          failed: totalEnrichFailed 
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
          
          totalThesisSucceeded += batchThesisSucceeded;
          totalThesisFailed += batchThesisFailed;
        }
        
        setExtractionProgress({ 
          processed: i + batch.length, 
          total: totalContacts, 
          succeeded: totalThesisSucceeded, 
          failed: totalThesisFailed 
        });
        
        queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
        queryClient.invalidateQueries({ queryKey: ['/enrich-stats'] });
        queryClient.invalidateQueries({ queryKey: ['/thesis-extraction-stats'] });
        
        if (i + BATCH_SIZE < allContacts.length && !abortRef.current) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      setIsPipelineRunning(false);
      setCurrentBatch(0);
      
      if (abortRef.current) {
        toast({ 
          title: "Pipeline stopped", 
          description: `Enriched: ${totalEnrichSucceeded}/${totalContacts}. Thesis: ${totalThesisSucceeded}/${totalContacts}.` 
        });
      } else {
        toast({ 
          title: "Contact Intelligence Pipeline Complete!", 
          description: `Enriched ${totalEnrichSucceeded}/${totalContacts} contacts. Extracted thesis for ${totalThesisSucceeded}/${totalContacts}.` 
        });
      }
      
    } catch (error) {
      console.error('Pipeline error:', error);
      toast({ title: "Pipeline error", description: String(error), variant: "destructive" });
      setIsPipelineRunning(false);
    }
  }, [isPipelineRunning, toast, queryClient]);

  const pauseResumePipeline = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setIsPipelinePaused(pausedRef.current);
    toast({ title: pausedRef.current ? "Pipeline paused" : "Pipeline resumed" });
  }, [toast]);

  const stopPipeline = useCallback(() => {
    abortRef.current = true;
    pausedRef.current = false;
    setIsPipelinePaused(false);
    toast({ title: "Stopping pipeline...", description: "Will stop after current batch completes" });
  }, [toast]);

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
      pauseResumePipeline,
      stopPipeline,
    }}>
      {children}
    </PipelineContext.Provider>
  );
}

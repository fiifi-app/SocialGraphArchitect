import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import TranscriptView from "@/components/TranscriptView";
import SuggestionCard from "@/components/SuggestionCard";
import { Mic, Square, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import {
  useCreateConversation,
  useUpdateConversation,
} from "@/hooks/useConversations";
import {
  transcribeAudio,
  extractParticipants,
  extractEntities,
  generateMatches,
  processParticipants,
} from "@/lib/edgeFunctions";
import { supabase } from "@/lib/supabase";

interface TranscriptEntry {
  t: string;
  speaker: string | null;
  text: string;
}

interface Suggestion {
  contact: {
    name: string;
    email: string | null;
    company: string | null;
    title: string | null;
  };
  score: 1 | 2 | 3;
  reasons: string[];
}

interface RecordingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string | null;
}

export default function RecordingDrawer({ open, onOpenChange, eventId }: RecordingDrawerProps) {
  const [title, setTitle] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const lastExtractTimeRef = useRef<number>(0);
  const lastMatchTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<Blob[]>([]);
  const isUploadingRef = useRef(false);

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createConversation = useCreateConversation();
  const updateConversation = useUpdateConversation();

  const handleAudioData = useCallback(async (audioBlob: Blob) => {
    if (!conversationIdRef.current) return;

    console.log('✅ Audio chunk received:', audioBlob.size, 'bytes');
    audioQueueRef.current.push(audioBlob);

    if (!isUploadingRef.current) {
      await processAudioQueue();
    }
  }, []);

  const processAudioQueue = async () => {
    const currentConversationId = conversationIdRef.current;
    if (audioQueueRef.current.length === 0 || !currentConversationId) return;

    isUploadingRef.current = true;
    setIsTranscribing(true);

    try {
      const blob = audioQueueRef.current.shift();
      if (!blob) return;

      const result = await transcribeAudio(blob, currentConversationId);
      console.log('✅ Transcription result:', result);

      if (audioQueueRef.current.length > 0) {
        await processAudioQueue();
      }
    } catch (error) {
      console.error('❌ Transcription error:', error);
      toast({
        title: "Transcription error",
        description: error instanceof Error ? error.message : "Failed to transcribe audio",
        variant: "destructive",
      });
    } finally {
      isUploadingRef.current = false;
      setIsTranscribing(false);
    }
  };

  const { state: audioState, controls: audioControls } = useAudioRecorder(handleAudioData);

  const hours = Math.floor(audioState.duration / 3600);
  const minutes = Math.floor((audioState.duration % 3600) / 60);
  const seconds = audioState.duration % 60;
  const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const handleStartRecording = async () => {
    if (!consentChecked) {
      toast({
        title: "Consent required",
        description: "Please confirm you have consent to record",
        variant: "destructive",
      });
      return;
    }

    console.log('🎬 Starting recording...');
    console.log('📝 Creating conversation...');

    const result = await createConversation.mutateAsync({
      title: title || `Conversation - ${new Date().toLocaleString()}`,
      recordedAt: new Date(),
      status: 'recording',
      eventId: eventId || null,
      ownedByProfile: '',
    } as any);

    if (!result || !result.id) {
      toast({
        title: "Failed to create conversation",
        description: "Please try again",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Conversation created:', result.id);
    setConversationId(result.id);
    conversationIdRef.current = result.id;

    console.log('🎤 Starting audio recorder...');
    await audioControls.startRecording();
  };

  const handleStop = async () => {
    if (!conversationIdRef.current) return;
    
    console.log('⏹ Stopping recording...');
    setIsProcessing(true);
    
    try {
      const finalBlob = await audioControls.stopRecording();
      
      if (finalBlob && finalBlob.size > 0) {
        await transcribeAudio(finalBlob, conversationIdRef.current);
      }
      
      await updateConversation.mutateAsync({
        id: conversationIdRef.current,
        status: 'processing',
      });
      
      await processParticipants(conversationIdRef.current);
      
      // Extract entities one final time to ensure all are captured
      console.log('🔍 Extracting entities from complete transcript...');
      await extractEntities(conversationIdRef.current);
      
      // Generate final matches based on all conversation data
      console.log('🎯 Generating final matches...');
      await generateMatches(conversationIdRef.current);
      
      await updateConversation.mutateAsync({
        id: conversationIdRef.current,
        status: 'completed',
      });

      toast({
        title: "Matches and transcripts completed!",
        description: "Your conversation has been processed successfully",
      });

      setLocation(`/conversation/${conversationIdRef.current}`);
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to stop recording",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }

    onOpenChange(false);
    resetState();
  };

  const handlePause = () => {
    if (audioState.isPaused) {
      audioControls.resumeRecording();
    } else {
      audioControls.pauseRecording();
    }
  };

  const resetState = () => {
    setTitle("");
    setConsentChecked(false);
    setConversationId(null);
    setTranscript([]);
    setSuggestions([]);
    conversationIdRef.current = null;
    lastExtractTimeRef.current = 0;
    lastMatchTimeRef.current = 0;
    audioQueueRef.current = [];
  };

  useEffect(() => {
    if (!open && audioState.isRecording) {
      handleStop();
    }
  }, [open]);

  useEffect(() => {
    if (!conversationId) return;

    console.log('🔌 Setting up real-time subscription for conversation:', conversationId);

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_segments',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('📝 Received transcript segment:', payload.new);
          const segment = payload.new;
          setTranscript((prev) => [
            ...prev,
            {
              t: segment.timestamp_ms ? new Date(parseInt(segment.timestamp_ms)).toLocaleTimeString() : '',
              speaker: segment.speaker || null,
              text: segment.text || '',
            },
          ]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_suggestions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log('🎯 Received match suggestion:', payload.new);
          const match = payload.new;
          
          // Fetch the contact details for this match
          const { data: contactData, error } = await supabase
            .from('contacts')
            .select('name, email, company, title')
            .eq('id', match.contact_id)
            .single();
          
          // Guard against missing or failed contact fetch
          if (error || !contactData) {
            console.error('Failed to fetch contact for match:', error);
            toast({
              title: "Error loading contact",
              description: "Failed to load contact details for a new match",
              variant: "destructive",
            });
            return;
          }
          
          setSuggestions((prev) => [
            ...prev,
            {
              contact: {
                name: contactData.name,
                email: contactData.email,
                company: contactData.company,
                title: contactData.title,
              },
              score: (match.score || 1) as 1 | 2 | 3,
              reasons: match.reasons || [],
            },
          ]);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Unsubscribing from conversation:', conversationId);
      supabase.removeChannel(channel);
    };
  }, [conversationId, toast]);

  useEffect(() => {
    if (!conversationId || !audioState.isRecording || audioState.isPaused) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      
      if (now - lastExtractTimeRef.current >= 15000 && transcript.length > 0) {
        try {
          await extractParticipants(conversationId);
          lastExtractTimeRef.current = now;
        } catch (error) {
          console.error('Participant extraction error:', error);
        }
      }
      
      if (now - lastMatchTimeRef.current >= 15000 && transcript.length > 0) {
        try {
          console.log('🔍 Extracting entities...');
          await extractEntities(conversationId);
          
          console.log('🎯 Generating matches...');
          const matchData = await generateMatches(conversationId);
          
          if (matchData.matches && matchData.matches.length > 0) {
            console.log(`🎉 Found ${matchData.matches.length} matches!`);
            const newSuggestions = matchData.matches.map((m: any) => ({
              contact: {
                name: m.contact_name || 'Unknown',
                email: m.contact_email || null,
                company: m.contact_company || null,
                title: m.contact_title || null,
              },
              score: m.score,
              reasons: m.reasons || [],
            }));
            
            setSuggestions(newSuggestions);
            
            const highValueMatches = newSuggestions.filter((s: Suggestion) => s.score === 3);
            if (highValueMatches.length > 0) {
              toast({
                title: "New match found!",
                description: `${highValueMatches[0].contact.name} - ${highValueMatches[0].score} stars`,
              });
            }
          }
          lastMatchTimeRef.current = now;
        } catch (error) {
          console.error('Match generation error:', error);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [conversationId, audioState.isRecording, audioState.isPaused, transcript.length, toast]);

  const isRecording = audioState.isRecording;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[50vh]">
        <DrawerHeader>
          <DrawerTitle>{isRecording ? 'Recording in Progress' : 'New Meeting'}</DrawerTitle>
        </DrawerHeader>

        {isProcessing ? (
          <div className="px-4 flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-full max-w-md space-y-3">
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                </div>
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Processing conversation and generating matches...
              </p>
              <p className="text-xs text-center text-muted-foreground">
                This may take a few moments
              </p>
            </div>
          </div>
        ) : !isRecording ? (
          <div className="px-4 space-y-4 overflow-auto">
            <div className="space-y-2">
              <Label htmlFor="title">Meeting Title</Label>
              <Input
                id="title"
                placeholder="Enter title or we will auto fill once the meeting begins"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-meeting-title"
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border">
              <Checkbox
                id="consent-drawer"
                checked={consentChecked}
                onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                data-testid="checkbox-consent"
              />
              <label htmlFor="consent-drawer" className="text-sm cursor-pointer select-none">
                I have consent from all parties to record this conversation
              </label>
            </div>
          </div>
        ) : (
          <div className="px-4 flex-1 overflow-auto">
            <div className="flex items-center mb-4">
              <div className="flex items-center gap-3">
                {isTranscribing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span>Transcribing...</span>
                  </div>
                )}
                {!isTranscribing && transcript.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {transcript.length} segment{transcript.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <Tabs defaultValue="matches">
              <TabsList className="mb-4">
                <TabsTrigger value="matches">
                  Matches {suggestions.length > 0 && `(${suggestions.length})`}
                </TabsTrigger>
                <TabsTrigger value="transcript">
                  Transcript {transcript.length > 0 && `(${transcript.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="matches">
                <div className="space-y-2 h-48 overflow-auto">
                  {suggestions.length > 0 ? (
                    suggestions.map((suggestion, idx) => (
                      <SuggestionCard 
                        key={idx} 
                        contact={suggestion.contact}
                        score={suggestion.score}
                        reasons={suggestion.reasons}
                        onPromise={() => console.log('Promise', suggestion.contact.name)}
                        onMaybe={() => console.log('Maybe', suggestion.contact.name)}
                        onDismiss={() => console.log('Dismiss', suggestion.contact.name)}
                      />
                    ))
                  ) : (
                    <Card className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 border-dashed">
                      <Users className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm text-center">No matches yet</p>
                      <p className="text-xs text-center mt-1">Continue talking to discover connections</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="transcript">
                <Card className="p-0 h-48 overflow-auto">
                  {transcript.length > 0 ? (
                    <TranscriptView transcript={transcript} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                      <Mic className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm text-center">Waiting for audio transcription...</p>
                      <p className="text-xs text-center mt-1">Speak to see the transcript</p>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DrawerFooter>
          <div className="flex items-center justify-between w-full gap-4">
            {isProcessing ? null : isRecording ? (
              <>
                <Button
                  variant="outline"
                  onClick={handlePause}
                  data-testid="button-pause-resume"
                >
                  {audioState.isPaused ? 'Resume' : 'Pause'}
                </Button>
                <div className="text-lg font-mono font-semibold" data-testid="text-duration">
                  {formattedDuration}
                </div>
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  data-testid="button-stop"
                >
                  <Square className="w-4 h-4 mr-2" />
                  End
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!consentChecked || createConversation.isPending}
                  onClick={handleStartRecording}
                  data-testid="button-start"
                  className="px-8"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  {createConversation.isPending ? 'Starting...' : 'Start Recording'}
                </Button>
              </>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

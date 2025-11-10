import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RecordingIndicator from "@/components/RecordingIndicator";
import TranscriptView from "@/components/TranscriptView";
import SuggestionCard from "@/components/SuggestionCard";
import { Mic, Calendar, Clock, MapPin, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useSearch } from "wouter";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { 
  useCreateConversation, 
  useUpdateConversation,
  useConversationSegments 
} from "@/hooks/useConversations";
import { useMatchSuggestions } from "@/hooks/useMatches";
import { 
  transcribeAudio,
  extractParticipants,
  extractEntities,
  generateMatches,
  processParticipants 
} from "@/lib/edgeFunctions";
import { supabase } from "@/lib/supabase";
import { calendarEventFromDb } from "@/lib/supabaseHelpers";
import type { CalendarEvent } from "@shared/schema";
import { format } from "date-fns";

interface TranscriptEntry {
  t: string;
  speaker: string | null;
  text: string;
}

interface Suggestion {
  contactName: string;
  score: 1 | 2 | 3;
  reasons: string[];
}

export default function Record() {
  const searchParams = useSearch();
  const eventId = new URLSearchParams(searchParams).get('eventId');
  
  const [consentChecked, setConsentChecked] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const lastExtractTimeRef = useRef<number>(0);
  const lastMatchTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<Blob[]>([]);
  const isUploadingRef = useRef(false);
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createConversation = useCreateConversation();
  const updateConversation = useUpdateConversation();

  // Load calendar event if eventId is provided
  useEffect(() => {
    if (eventId) {
      supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .single()
        .then(({ data, error }) => {
          if (data && !error) {
            setCalendarEvent(calendarEventFromDb(data));
          }
        });
    }
  }, [eventId]);

  // Audio chunk handler
  const handleAudioData = useCallback(async (audioBlob: Blob) => {
    if (!conversationIdRef.current) {
      console.log('❌ No conversationId, skipping audio');
      return;
    }
    
    console.log('✅ Audio chunk received:', audioBlob.size, 'bytes', 'conversationId:', conversationIdRef.current);
    audioQueueRef.current.push(audioBlob);
    
    // Process queue if not already uploading
    if (!isUploadingRef.current) {
      await processAudioQueue();
    }
  }, []);

  // Process audio queue sequentially
  const processAudioQueue = async () => {
    const currentConversationId = conversationIdRef.current;
    if (audioQueueRef.current.length === 0 || !currentConversationId) return;
    
    isUploadingRef.current = true;
    setIsTranscribing(true);
    
    try {
      const blob = audioQueueRef.current.shift();
      if (!blob) return;
      
      console.log('🎤 Sending audio to transcription:', blob.size, 'bytes, conversationId:', currentConversationId);
      
      // Send to transcription Edge Function
      const result = await transcribeAudio(blob, currentConversationId);
      console.log('✅ Transcription result:', result);
      
      // Continue processing queue
      if (audioQueueRef.current.length > 0) {
        await processAudioQueue();
      }
    } catch (error) {
      console.error('❌ Transcription error DETAILS:', error);
      console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));
      toast({
        title: "Transcription error",
        description: error instanceof Error ? error.message : "Failed to transcribe audio chunk",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
      isUploadingRef.current = false;
    }
  };

  // Audio recorder
  const { state: audioState, controls: audioControls } = useAudioRecorder(handleAudioData);

  // Format duration for display
  const formattedDuration = `${Math.floor(audioState.duration / 60).toString().padStart(2, '0')}:${(audioState.duration % 60).toString().padStart(2, '0')}`;

  // Subscribe to realtime conversation segments
  useEffect(() => {
    if (!conversationId) return;

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
          const segment = payload.new;
          setTranscript(prev => [...prev, {
            t: new Date().toISOString(),
            speaker: segment.speaker,
            text: segment.text,
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Periodic AI processing (every 30 seconds)
  useEffect(() => {
    if (!conversationId || !audioState.isRecording || audioState.isPaused) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      
      // Extract participants every 30s
      if (now - lastExtractTimeRef.current >= 30000 && transcript.length > 0) {
        try {
          await extractParticipants(conversationId);
          lastExtractTimeRef.current = now;
        } catch (error) {
          console.error('Participant extraction error:', error);
        }
      }
      
      // Generate matches every 30s
      if (now - lastMatchTimeRef.current >= 30000 && transcript.length > 0) {
        try {
          // First extract entities from the conversation
          console.log('🔍 Extracting entities from conversation...');
          await extractEntities(conversationId);
          
          // Then generate matches based on extracted entities
          console.log('🎯 Generating matches...');
          const matchData = await generateMatches(conversationId);
          if (matchData.matches && matchData.matches.length > 0) {
            // Update suggestions with new matches
            const newSuggestions = matchData.matches.map((m: any) => ({
              contactName: m.contact_name || 'Unknown',
              score: m.score,
              reasons: m.reasons || [],
            }));
            
            setSuggestions(newSuggestions);
            
            // Toast for new high-value matches
            const highValueMatches = newSuggestions.filter((s: Suggestion) => s.score === 3);
            if (highValueMatches.length > 0) {
              toast({
                title: "New match found!",
                description: `${highValueMatches[0].contactName} - ${highValueMatches[0].score} stars`,
              });
            }
          }
          lastMatchTimeRef.current = now;
        } catch (error) {
          console.error('Match generation error:', error);
        }
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [conversationId, audioState.isRecording, audioState.isPaused, transcript.length, toast]);

  const handleStartRecording = async () => {
    if (!consentChecked) return;
    
    try {
      console.log('🎬 Starting recording...');
      
      // Create conversation in database
      console.log('📝 Creating conversation...');
      const conversation = await createConversation.mutateAsync({
        title: calendarEvent ? calendarEvent.title : `Conversation - ${new Date().toLocaleString()}`,
        recordedAt: new Date(),
        status: 'recording',
        eventId: eventId || null,
        ownedByProfile: '', // Added by the hook automatically
      } as any);
      
      console.log('✅ Conversation created:', conversation.id);
      setConversationId(conversation.id);
      conversationIdRef.current = conversation.id; // Update ref immediately
      setTranscript([]);
      setSuggestions([]);
      lastExtractTimeRef.current = 0;
      lastMatchTimeRef.current = 0;
      audioQueueRef.current = [];
      
      // Start audio recording
      console.log('🎤 Starting audio recorder...');
      await audioControls.startRecording();
      
      toast({
        title: "Recording started",
        description: "Your conversation is being recorded and transcribed in real-time.",
      });
    } catch (error) {
      console.error('❌ Failed to start recording - FULL ERROR:', error);
      console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start recording",
        variant: "destructive",
      });
    }
  };

  const handlePause = () => {
    if (audioState.isPaused) {
      audioControls.resumeRecording();
    } else {
      audioControls.pauseRecording();
    }
  };

  const handleStop = async () => {
    if (!conversationId) return;
    
    setIsProcessing(true);
    
    try {
      // Stop recording and get final audio blob
      const finalBlob = await audioControls.stopRecording();
      
      // Flush final audio chunk
      if (finalBlob && finalBlob.size > 0) {
        await transcribeAudio(finalBlob, conversationId);
      }
      
      // Mark conversation as processing
      await updateConversation.mutateAsync({
        id: conversationId,
        status: 'processing',
      });
      
      // Process participants (duplicate detection, auto-fill, pending contacts)
      const processResult = await processParticipants(conversationId);
      
      // Mark conversation as completed
      await updateConversation.mutateAsync({
        id: conversationId,
        status: 'completed',
      });
      
      // Show results
      const { newContacts, updatedContacts, duplicatesFound } = processResult.results || {};
      
      let description = '';
      if (newContacts && newContacts.length > 0) {
        description += `${newContacts.length} new contact(s) added for review. `;
      }
      if (updatedContacts && updatedContacts.length > 0) {
        description += `${updatedContacts.length} contact(s) updated with new information. `;
      }
      if (duplicatesFound && duplicatesFound.length > 0) {
        description += `${duplicatesFound.length} duplicate(s) found.`;
      }
      
      toast({
        title: "Recording saved!",
        description: description || "Conversation processed successfully.",
      });
      
      // Redirect to history
      setTimeout(() => {
        setLocation('/history');
      }, 1500);
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast({
        title: "Error",
        description: "Failed to process recording. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (!audioState.isRecording) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <div className="text-center max-w-2xl w-full">
          {calendarEvent && (
            <Card className="mb-8 p-6 text-left" data-testid="card-event-details">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2" data-testid="text-event-title">
                    {calendarEvent.title}
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span data-testid="text-event-time">
                        {format(calendarEvent.startTime, 'EEEE, MMMM d, yyyy • h:mm a')} - {format(calendarEvent.endTime, 'h:mm a')}
                      </span>
                    </div>
                    {calendarEvent.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span data-testid="text-event-location">{calendarEvent.location}</span>
                      </div>
                    )}
                    {calendarEvent.attendees && Array.isArray(calendarEvent.attendees) && calendarEvent.attendees.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span data-testid="text-event-attendees">
                          {(calendarEvent.attendees as any[]).length} attendee{(calendarEvent.attendees as any[]).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <div className="mb-12">
            <h1 className="text-2xl font-semibold mb-3">
              {calendarEvent ? 'Ready to Record' : 'Start a New Recording'}
            </h1>
            <p className="text-muted-foreground">
              Record conversations to get AI-powered intro suggestions in real-time
            </p>
          </div>

          <div className="mb-8 flex items-center justify-center gap-3 p-4 bg-muted/30 rounded-lg border border-border">
            <Checkbox
              id="consent"
              checked={consentChecked}
              onCheckedChange={(checked) => {
                const isChecked = checked as boolean;
                setConsentChecked(isChecked);
                if (isChecked) {
                  setTimeout(() => handleStartRecording(), 300);
                }
              }}
              data-testid="checkbox-consent"
            />
            <label
              htmlFor="consent"
              className="text-sm cursor-pointer select-none"
            >
              I have consent from all parties to record this conversation
            </label>
          </div>

          {audioState.error && (
            <Card className="p-4 mb-4 border-destructive">
              <p className="text-sm text-destructive">{audioState.error}</p>
            </Card>
          )}

          <Button
            size="lg"
            disabled={!consentChecked || createConversation.isPending}
            onClick={handleStartRecording}
            data-testid="button-start-recording"
            className="gap-2"
          >
            <Mic className="w-5 h-5" />
            {createConversation.isPending ? 'Starting...' : 'Start Recording'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <RecordingIndicator
        isRecording={true}
        isPaused={audioState.isPaused}
        duration={formattedDuration}
        onPause={handlePause}
        onStop={handleStop}
      />

      <div className="mt-20 px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Recording in Progress</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isTranscribing && 'Transcribing audio... '}
              {isProcessing && 'Processing conversation... '}
              {suggestions.length > 0 && `${suggestions.length} match(es) found`}
            </p>
          </div>
        </div>

        <Tabs defaultValue="transcript" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="transcript" data-testid="tab-transcript">
              Transcript {transcript.length > 0 && `(${transcript.length})`}
            </TabsTrigger>
            <TabsTrigger value="matches" data-testid="tab-matches">
              Matches {suggestions.length > 0 && `(${suggestions.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcript">
            <Card className="p-0 h-96">
              <TranscriptView transcript={transcript} />
            </Card>
            {transcript.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p>Waiting for audio transcription...</p>
                <p className="text-sm mt-2">Speak to see the transcript appear here</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="matches">
            <div className="space-y-4">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion, idx) => (
                  <SuggestionCard
                    key={idx}
                    {...suggestion}
                    onPromise={() => console.log('Promised', suggestion.contactName)}
                    onMaybe={() => console.log('Maybe', suggestion.contactName)}
                    onDismiss={() => console.log('Dismissed', suggestion.contactName)}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No matches found yet</p>
                  <p className="text-sm mt-2">
                    Continue the conversation to find relevant contacts
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

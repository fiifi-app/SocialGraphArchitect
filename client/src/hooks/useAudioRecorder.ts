import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  error: string | null;
}

export interface AudioRecorderControls {
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
}

export function useAudioRecorder(onDataAvailable?: (audioBlob: Blob) => void) {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Optimal for Whisper API
        } 
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Create MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          
          // Send chunk for processing if callback provided
          if (onDataAvailable) {
            onDataAvailable(event.data);
          }
          
          // Restart recording to ensure each chunk is a complete webm file
          // This is necessary because OpenAI Whisper requires complete audio files,
          // not fragments. The first chunk has a webm header, but subsequent chunks
          // from the same start() call are headerless fragments.
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            // Start a new recording immediately to capture the next 5-second chunk
            setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                mediaRecorderRef.current.start();
              }
            }, 100);
          }
        }
      };

      // Start recording - will automatically create 5-second chunks
      mediaRecorder.start(5000);

      // Start duration timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setState(prev => ({ ...prev, duration: seconds }));
      }, 1000);

      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        error: null,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setState(prev => ({
        ...prev,
        error: errorMessage,
      }));
      console.error('Error starting recording:', error);
    }
  }, [onDataAvailable]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, [state.isRecording, state.isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume();
      
      // Resume timer
      let seconds = state.duration;
      timerRef.current = setInterval(() => {
        seconds++;
        setState(prev => ({ ...prev, duration: seconds }));
      }, 1000);

      setState(prev => ({ ...prev, isPaused: false }));
    }
  }, [state.isRecording, state.isPaused, state.duration]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        setState({
          isRecording: false,
          isPaused: false,
          duration: 0,
          error: null,
        });

        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  return {
    state,
    controls: {
      startRecording,
      pauseRecording,
      resumeRecording,
      stopRecording,
    },
  };
}

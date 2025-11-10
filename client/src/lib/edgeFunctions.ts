import { supabase } from './supabase';

export async function transcribeAudio(audioBlob: Blob, conversationId: string) {
  const formData = new FormData();
  formData.append('audio', audioBlob);
  formData.append('conversation_id', conversationId);

  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: formData,
  });

  if (error) {
    console.error('🔥 Edge Function error:', error);
    console.error('🔥 Error data:', data);
    throw new Error(data?.error || error.message || 'Transcription failed');
  }
  return data;
}

export async function extractParticipants(conversationId: string) {
  const { data, error } = await supabase.functions.invoke('extract-participants', {
    body: { conversationId },
  });

  if (error) throw error;
  return data;
}

export async function processParticipants(conversationId: string) {
  const { data, error } = await supabase.functions.invoke('process-participants', {
    body: { conversationId },
  });

  if (error) throw error;
  return data;
}

export async function enrichContact(contactId: string, provider?: 'hunter' | 'pdl' | 'auto') {
  const { data, error } = await supabase.functions.invoke('enrich-contact', {
    body: { contactId, provider: provider || 'auto' },
  });
  
  if (error) throw error;
  return data;
}

export async function extractEntities(conversationId: string) {
  const { data, error } = await supabase.functions.invoke('extract-entities', {
    body: { conversationId }
  });
  
  if (error) {
    console.error('❌ Extract entities error:', error);
    console.error('❌ Error data:', data);
    throw error;
  }
  return data;
}

export async function generateMatches(conversationId: string) {
  const { data, error } = await supabase.functions.invoke('generate-matches', {
    body: { conversationId }
  });
  
  if (error) {
    console.error('❌ Generate matches error:', error);
    console.error('❌ Error data:', data);
    throw error;
  }
  return data;
}

export async function generateIntroEmail(matchSuggestionId: string, conversationId: string) {
  const { data, error } = await supabase.functions.invoke('generate-intro-email', {
    body: { matchSuggestionId, conversationId }
  });
  
  if (error) throw error;
  return data;
}

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
  console.log('[5s interval] Extracting entities...');
  const { data, error } = await supabase.functions.invoke('extract-entities', {
    body: { conversationId }
  });
  
  if (error) {
    console.error('❌ Extract entities error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error context:', error.context);
    console.error('❌ Response data:', data);
    throw error;
  }
  console.log('✅ Entities extracted successfully:', data);
  return data;
}

export async function generateMatches(conversationId: string) {
  console.log('[5s interval] Generating matches...');
  const { data, error } = await supabase.functions.invoke('generate-matches', {
    body: { conversationId }
  });
  
  if (error) {
    console.error('❌ Generate matches error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error context:', error.context);
    console.error('❌ Response data:', data);
    throw error;
  }
  console.log('✅ Matches generated successfully:', data);
  return data;
}

export async function generateIntroEmail(matchSuggestionId: string, conversationId: string) {
  const { data, error } = await supabase.functions.invoke('generate-intro-email', {
    body: { matchSuggestionId, conversationId }
  });
  
  if (error) throw error;
  return data;
}

export async function extractThesis(contactId: string) {
  console.log('[Thesis] Extracting thesis keywords for contact:', contactId);
  const { data, error } = await supabase.functions.invoke('extract-thesis', {
    body: { contactId }
  });
  
  if (error) {
    console.error('Extract thesis error:', error);
    throw error;
  }
  console.log('Thesis extracted successfully:', data);
  return data;
}

// Hunter.io email finding
export async function checkHunterStatus() {
  const { data, error } = await supabase.functions.invoke('hunter-batch', {
    body: { action: 'check' }
  });
  
  if (error) throw error;
  return data;
}

export async function runHunterBatch(limit: number = 1) {
  const { data, error } = await supabase.functions.invoke('hunter-batch', {
    body: { action: 'process', limit }
  });
  
  if (error) throw error;
  return data;
}

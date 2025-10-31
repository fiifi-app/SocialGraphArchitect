import { supabase } from './supabase';

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
  
  if (error) throw error;
  return data;
}

export async function generateMatches(conversationId: string) {
  const { data, error } = await supabase.functions.invoke('generate-matches', {
    body: { conversationId }
  });
  
  if (error) throw error;
  return data;
}

export async function generateIntroEmail(matchSuggestionId: string, conversationId: string) {
  const { data, error } = await supabase.functions.invoke('generate-intro-email', {
    body: { matchSuggestionId, conversationId }
  });
  
  if (error) throw error;
  return data;
}

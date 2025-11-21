import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { conversationFromDb, conversationToDb, segmentFromDb, segmentToDb } from '@/lib/supabaseHelpers';
import type { Conversation, InsertConversation, ConversationSegment, InsertConversationSegment } from '@shared/schema';

export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('recorded_at', { ascending: false});
      
      if (error) throw error;
      return (data || []).map(conversationFromDb);
    },
  });
}

export function useConversation(id: string) {
  return useQuery<Conversation>({
    queryKey: ['/api/conversations', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return conversationFromDb(data);
    },
    enabled: !!id,
  });
}

export function useConversationSegments(conversationId: string) {
  return useQuery<ConversationSegment[]>({
    queryKey: ['/api/conversations', conversationId, 'segments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversation_segments')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp_ms', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(segmentFromDb);
    },
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  return useMutation({
    mutationFn: async (conversation: InsertConversation) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dbConversation = conversationToDb({
        ...conversation,
        ownedByProfile: user.id,
      });

      const { data, error } = await supabase
        .from('conversations')
        .insert(dbConversation)
        .select()
        .single();
      
      if (error) throw error;
      return conversationFromDb(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
  });
}

export function useAddConversationSegment() {
  return useMutation({
    mutationFn: async (segment: InsertConversationSegment) => {
      const dbSegment = segmentToDb(segment);
      
      const { data, error } = await supabase
        .from('conversation_segments')
        .insert(dbSegment)
        .select()
        .single();
      
      if (error) throw error;
      return segmentFromDb(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', data.conversationId, 'segments'] 
      });
    },
  });
}

export function useUpdateConversation() {
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Conversation> & { id: string }) => {
      const dbUpdates = conversationToDb(updates) as Record<string, any>;
      
      const { data, error } = await supabase
        .from('conversations')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return conversationFromDb(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', data.id] });
    },
  });
}

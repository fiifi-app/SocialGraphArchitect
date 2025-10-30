import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { matchFromDb } from '@/lib/supabaseHelpers';
import type { MatchSuggestion } from '@shared/schema';

interface MatchWithContact extends MatchSuggestion {
  contact?: {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
    title: string | null;
  };
}

export function useMatchSuggestions(conversationId: string) {
  return useQuery<MatchWithContact[]>({
    queryKey: ['/api/conversations', conversationId, 'matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_suggestions')
        .select(`
          *,
          contact:contacts (
            id,
            name,
            email,
            company,
            title
          )
        `)
        .eq('conversation_id', conversationId)
        .order('score', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        ...matchFromDb(row),
        contact: row.contact,
      }));
    },
    enabled: !!conversationId,
  });
}

export function useTopMatches(conversationId: string, minScore: number = 2) {
  return useQuery<MatchWithContact[]>({
    queryKey: ['/api/conversations', conversationId, 'top-matches', minScore],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_suggestions')
        .select(`
          *,
          contact:contacts (
            id,
            name,
            email,
            company,
            title
          )
        `)
        .eq('conversation_id', conversationId)
        .gte('score', minScore)
        .order('score', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        ...matchFromDb(row),
        contact: row.contact,
      }));
    },
    enabled: !!conversationId,
  });
}

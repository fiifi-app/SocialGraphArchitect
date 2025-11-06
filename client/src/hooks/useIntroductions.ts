import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface IntroductionThread {
  id: string;
  suggestionId: string;
  initiatedByProfile: string;
  contactAId: string;
  contactBId: string;
  currentStatus: string;
  meetingScheduled: boolean;
  meetingOutcome: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useIntroductionThreads() {
  return useQuery<IntroductionThread[]>({
    queryKey: ['/api/introductions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('introduction_threads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function useIntroductionStats() {
  return useQuery<{
    total: number;
    today: number;
    thisWeek: number;
  }>({
    queryKey: ['/api/introductions/stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('introduction_threads')
        .select('created_at')
        .in('current_status', ['sent', 'accepted', 'meeting_scheduled']);
      
      if (error) throw error;
      
      const intros = data || [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      return {
        total: intros.length,
        today: intros.filter(intro => new Date(intro.created_at) >= todayStart).length,
        thisWeek: intros.filter(intro => new Date(intro.created_at) >= weekStart).length,
      };
    },
  });
}

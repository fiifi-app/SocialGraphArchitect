import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { calendarEventFromDb } from '@/lib/supabaseHelpers';
import type { CalendarEvent } from '@shared/schema';

export function useUpcomingEvents() {
  return useQuery<CalendarEvent[]>({
    queryKey: ['/calendar-events/upcoming'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Unauthorized');

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('owned_by_profile', userData.user.id)
        .gte('start_time', now.toISOString())
        .lte('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(calendarEventFromDb);
    },
  });
}

export function useTodaysEvents() {
  return useQuery<CalendarEvent[]>({
    queryKey: ['/calendar-events/today'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return []; // Return empty array for unauthenticated users

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('owned_by_profile', userData.user.id)
        .gte('start_time', startOfDay.toISOString())
        .lt('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(calendarEventFromDb);
    },
  });
}

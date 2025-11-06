import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useGoogleCalendarSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if Google Calendar is connected
  const { data: isConnected } = useQuery({
    queryKey: ['/google-calendar/status', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from('user_preferences')
        .select('google_calendar_connected')
        .eq('profile_id', user.id)
        .single();
      
      if (error) return false;
      return data?.google_calendar_connected || false;
    },
    enabled: !!user,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-google-calendar`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate calendar events query to refetch
      queryClient.invalidateQueries({ queryKey: ['/calendar-events/today'] });
    },
  });

  return {
    isConnected,
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncError: syncMutation.error,
  };
}

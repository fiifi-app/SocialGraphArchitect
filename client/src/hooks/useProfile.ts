import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { profileFromDb, profileToDb, preferencesFromDb, preferencesToDb } from '@/lib/supabaseHelpers';
import type { Profile, UserPreferences } from '@shared/schema';

export function useProfile() {
  return useQuery<Profile | null>({
    queryKey: ['/api/profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return profileFromDb(data);
    },
  });
}

export function useUserPreferences() {
  return useQuery<UserPreferences | null>({
    queryKey: ['/api/preferences'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('profile_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return preferencesFromDb(data);
    },
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dbUpdates = profileToDb(updates);

      const { data, error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return profileFromDb(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
    },
  });
}

export function useUpdatePreferences() {
  return useMutation({
    mutationFn: async (updates: Partial<UserPreferences>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dbUpdates = preferencesToDb(updates);

      const { data, error} = await supabase
        .from('user_preferences')
        .update(dbUpdates)
        .eq('profile_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return preferencesFromDb(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/preferences'] });
    },
  });
}

import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { contactFromDb, contactToDb } from '@/lib/supabaseHelpers';
import type { Contact, InsertContact } from '@shared/schema';

export function useContacts() {
  return useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.warn('[useContacts] No authenticated user found');
          throw new Error('Not authenticated');
        }

        let allContacts: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .eq('owned_by_profile', user.id)
            .order('created_at', { ascending: false })
            .range(from, from + batchSize - 1);
          
          if (error) {
            console.error('[useContacts] Query error:', error);
            throw error;
          }
          
          if (data && data.length > 0) {
            allContacts = [...allContacts, ...data];
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        
        console.log('[useContacts] Loaded contacts:', allContacts.length);
        return allContacts.map(contactFromDb);
      } catch (error) {
        console.error('[useContacts] Failed to load contacts:', error);
        throw error;
      }
    },
  });
}

export function useContactsCount() {
  return useQuery<number>({
    queryKey: ['/api/contacts/count'],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.warn('[useContactsCount] No authenticated user found');
          return 0;
        }

        const { count, error } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('owned_by_profile', user.id);
        
        if (error) {
          console.error('[useContactsCount] Query error:', error);
          throw error;
        }
        console.log('[useContactsCount] Total contacts:', count);
        return count || 0;
      } catch (error) {
        console.error('[useContactsCount] Failed to get count:', error);
        throw error;
      }
    },
  });
}

export function useContact(id: string) {
  return useQuery<Contact>({
    queryKey: ['/api/contacts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return contactFromDb(data);
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  return useMutation({
    mutationFn: async (contact: InsertContact) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dbContact = contactToDb({
        ...contact,
        ownedByProfile: user.id,
      });

      const { data, error } = await supabase
        .from('contacts')
        .insert(dbContact)
        .select()
        .single();
      
      if (error) throw error;
      return contactFromDb(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/count'] });
    },
  });
}

export function useUpdateContact() {
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const dbUpdates = contactToDb(updates);
      
      const { data, error } = await supabase
        .from('contacts')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return contactFromDb(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts', data.id] });
    },
  });
}

export function useDeleteContact() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/count'] });
    },
  });
}

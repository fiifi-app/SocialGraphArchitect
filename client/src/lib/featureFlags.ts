import { supabase } from './supabase';

interface FeatureFlags {
  enableInvestorFields: boolean;
}

let cachedFlags: FeatureFlags | null = null;

/**
 * Check if a migration version has been applied
 */
async function checkMigrationVersion(version: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('migration_versions')
      .select('version')
      .eq('version', version)
      .single();
    
    if (error) {
      console.warn('Migration version check failed:', error);
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.warn('Migration version check error:', error);
    return false;
  }
}

/**
 * Get all feature flags
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (cachedFlags) {
    return cachedFlags;
  }

  // Check if investor fields migration has been applied
  const investorFieldsEnabled = await checkMigrationVersion('2025_01_05_investor_fields');

  cachedFlags = {
    enableInvestorFields: investorFieldsEnabled,
  };

  return cachedFlags;
}

/**
 * Invalidate feature flags cache (call after applying migrations)
 */
export function invalidateFeatureFlagsCache() {
  cachedFlags = null;
}

/**
 * Hook to use feature flags in React components
 */
import { useQuery } from '@tanstack/react-query';

export function useFeatureFlags() {
  return useQuery<FeatureFlags>({
    queryKey: ['/api/feature-flags'],
    queryFn: getFeatureFlags,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

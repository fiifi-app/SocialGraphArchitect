import { supabase } from './supabase';

export async function seedSampleContacts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const sampleContacts = [
    {
      name: 'Sarah Chen',
      email: 'sarah@sequoiacap.com',
      title: 'Partner',
      company: 'Sequoia Capital',
      linkedin_url: 'https://linkedin.com/in/sarahchen',
      is_lp: false,
      contact_type: 'investor',
      check_size_min: 1000000,
      check_size_max: 10000000,
      preferred_stages: ['Series A', 'Series B'],
      preferred_team_sizes: ['5-10', '11-50'],
      owned_by_profile: user.id,
    },
    {
      name: 'Michael Rodriguez',
      email: 'michael@benchmark.com',
      title: 'General Partner',
      company: 'Benchmark Capital',
      linkedin_url: 'https://linkedin.com/in/michaelrodriguez',
      is_lp: false,
      contact_type: 'investor',
      check_size_min: 500000,
      check_size_max: 5000000,
      preferred_stages: ['Seed', 'Series A'],
      preferred_team_sizes: ['1-5', '5-10'],
      owned_by_profile: user.id,
    },
    {
      name: 'Jennifer Park',
      email: 'jennifer@parkfamily.com',
      title: 'Investment Director',
      company: 'Park Family Office',
      linkedin_url: 'https://linkedin.com/in/jenniferpark',
      is_lp: true,
      contact_type: 'lp',
      is_family_office: true,
      avg_check_size: 2500000,
      investment_types: ['Direct', 'Fund-of-Funds'],
      owned_by_profile: user.id,
    },
  ];

  const { data, error } = await supabase
    .from('contacts')
    .insert(sampleContacts)
    .select();

  if (error) throw error;
  return data;
}

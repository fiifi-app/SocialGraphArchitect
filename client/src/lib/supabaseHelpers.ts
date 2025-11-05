/**
 * Serialization helpers to convert between Supabase snake_case and TypeScript camelCase
 */

import type { Contact, Conversation, Profile, UserPreferences, ConversationSegment, MatchSuggestion } from '@shared/schema';

// ============================================================================
// CONTACTS
// ============================================================================

export function contactFromDb(dbRow: any): Contact {
  return {
    id: dbRow.id,
    ownedByProfile: dbRow.owned_by_profile,
    name: dbRow.name,
    firstName: dbRow.first_name,
    lastName: dbRow.last_name,
    email: dbRow.email,
    company: dbRow.company,
    title: dbRow.title,
    linkedinUrl: dbRow.linkedin_url,
    location: dbRow.location,
    phone: dbRow.phone,
    category: dbRow.category,
    twitter: dbRow.twitter,
    angellist: dbRow.angellist,
    isShared: dbRow.is_shared,
    isLp: dbRow.is_lp ?? false,
    contactType: dbRow.contact_type ?? 'investor',
    checkSizeMin: dbRow.check_size_min,
    checkSizeMax: dbRow.check_size_max,
    preferredStages: dbRow.preferred_stages,
    preferredTeamSizes: dbRow.preferred_team_sizes,
    preferredTenure: dbRow.preferred_tenure,
    isFamilyOffice: dbRow.is_family_office ?? false,
    investmentTypes: dbRow.investment_types,
    avgCheckSize: dbRow.avg_check_size,
    createdAt: new Date(dbRow.created_at),
    updatedAt: new Date(dbRow.updated_at),
  };
}

export function contactToDb(contact: Partial<Contact>): any {
  const dbRow: any = {};
  
  if (contact.id !== undefined) dbRow.id = contact.id;
  if (contact.ownedByProfile !== undefined) dbRow.owned_by_profile = contact.ownedByProfile;
  if (contact.name !== undefined) dbRow.name = contact.name;
  if (contact.firstName !== undefined) dbRow.first_name = contact.firstName;
  if (contact.lastName !== undefined) dbRow.last_name = contact.lastName;
  if (contact.email !== undefined) dbRow.email = contact.email;
  if (contact.company !== undefined) dbRow.company = contact.company;
  if (contact.title !== undefined) dbRow.title = contact.title;
  if (contact.linkedinUrl !== undefined) dbRow.linkedin_url = contact.linkedinUrl;
  if (contact.location !== undefined) dbRow.location = contact.location;
  if (contact.phone !== undefined) dbRow.phone = contact.phone;
  if (contact.category !== undefined) dbRow.category = contact.category;
  if (contact.twitter !== undefined) dbRow.twitter = contact.twitter;
  if (contact.angellist !== undefined) dbRow.angellist = contact.angellist;
  if (contact.isShared !== undefined) dbRow.is_shared = contact.isShared;
  if (contact.isLp !== undefined) dbRow.is_lp = contact.isLp;
  if (contact.contactType !== undefined) dbRow.contact_type = contact.contactType;
  if (contact.checkSizeMin !== undefined) dbRow.check_size_min = contact.checkSizeMin;
  if (contact.checkSizeMax !== undefined) dbRow.check_size_max = contact.checkSizeMax;
  if (contact.preferredStages !== undefined) dbRow.preferred_stages = contact.preferredStages;
  if (contact.preferredTeamSizes !== undefined) dbRow.preferred_team_sizes = contact.preferredTeamSizes;
  if (contact.preferredTenure !== undefined) dbRow.preferred_tenure = contact.preferredTenure;
  if (contact.isFamilyOffice !== undefined) dbRow.is_family_office = contact.isFamilyOffice;
  if (contact.investmentTypes !== undefined) dbRow.investment_types = contact.investmentTypes;
  if (contact.avgCheckSize !== undefined) dbRow.avg_check_size = contact.avgCheckSize;
  
  return dbRow;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

export function conversationFromDb(dbRow: any): Conversation {
  return {
    id: dbRow.id,
    ownedByProfile: dbRow.owned_by_profile,
    title: dbRow.title,
    durationSeconds: dbRow.duration_seconds,
    recordedAt: new Date(dbRow.recorded_at),
    status: dbRow.status,
    createdAt: new Date(dbRow.created_at),
  };
}

export function conversationToDb(conversation: Partial<Conversation>): any {
  const dbRow: any = {};
  
  if (conversation.id !== undefined) dbRow.id = conversation.id;
  if (conversation.ownedByProfile !== undefined) dbRow.owned_by_profile = conversation.ownedByProfile;
  if (conversation.title !== undefined) dbRow.title = conversation.title;
  if (conversation.durationSeconds !== undefined) dbRow.duration_seconds = conversation.durationSeconds;
  if (conversation.recordedAt !== undefined) dbRow.recorded_at = conversation.recordedAt.toISOString();
  if (conversation.status !== undefined) dbRow.status = conversation.status;
  
  return dbRow;
}

// ============================================================================
// CONVERSATION SEGMENTS
// ============================================================================

export function segmentFromDb(dbRow: any): ConversationSegment {
  return {
    id: dbRow.id,
    conversationId: dbRow.conversation_id,
    timestampMs: dbRow.timestamp_ms,
    speaker: dbRow.speaker,
    text: dbRow.text,
    createdAt: new Date(dbRow.created_at),
  };
}

export function segmentToDb(segment: Partial<ConversationSegment>): any {
  const dbRow: any = {};
  
  if (segment.id !== undefined) dbRow.id = segment.id;
  if (segment.conversationId !== undefined) dbRow.conversation_id = segment.conversationId;
  if (segment.timestampMs !== undefined) dbRow.timestamp_ms = segment.timestampMs;
  if (segment.speaker !== undefined) dbRow.speaker = segment.speaker;
  if (segment.text !== undefined) dbRow.text = segment.text;
  
  return dbRow;
}

// ============================================================================
// PROFILES
// ============================================================================

export function profileFromDb(dbRow: any): Profile {
  return {
    id: dbRow.id,
    email: dbRow.email,
    fullName: dbRow.full_name,
    role: dbRow.role,
    onboardingCompleted: dbRow.onboarding_completed,
    createdAt: new Date(dbRow.created_at),
    updatedAt: new Date(dbRow.updated_at),
  };
}

export function profileToDb(profile: Partial<Profile>): any {
  const dbRow: any = {};
  
  if (profile.id !== undefined) dbRow.id = profile.id;
  if (profile.email !== undefined) dbRow.email = profile.email;
  if (profile.fullName !== undefined) dbRow.full_name = profile.fullName;
  if (profile.role !== undefined) dbRow.role = profile.role;
  if (profile.onboardingCompleted !== undefined) dbRow.onboarding_completed = profile.onboardingCompleted;
  
  return dbRow;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

export function preferencesFromDb(dbRow: any): UserPreferences {
  return {
    profileId: dbRow.profile_id,
    autoTranscribe: dbRow.auto_transcribe,
    notificationEmail: dbRow.notification_email,
    matchThreshold: dbRow.match_threshold,
    createdAt: new Date(dbRow.created_at),
  };
}

export function preferencesToDb(prefs: Partial<UserPreferences>): any {
  const dbRow: any = {};
  
  if (prefs.profileId !== undefined) dbRow.profile_id = prefs.profileId;
  if (prefs.autoTranscribe !== undefined) dbRow.auto_transcribe = prefs.autoTranscribe;
  if (prefs.notificationEmail !== undefined) dbRow.notification_email = prefs.notificationEmail;
  if (prefs.matchThreshold !== undefined) dbRow.match_threshold = prefs.matchThreshold;
  
  return dbRow;
}

// ============================================================================
// MATCH SUGGESTIONS
// ============================================================================

export function matchFromDb(dbRow: any): MatchSuggestion {
  return {
    id: dbRow.id,
    conversationId: dbRow.conversation_id,
    contactId: dbRow.contact_id,
    score: dbRow.score,
    reasons: dbRow.reasons,
    justification: dbRow.justification,
    status: dbRow.status,
    promiseStatus: dbRow.promise_status,
    promisedAt: dbRow.promised_at ? new Date(dbRow.promised_at) : null,
    createdAt: new Date(dbRow.created_at),
    updatedAt: new Date(dbRow.updated_at),
  };
}

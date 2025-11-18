/**
 * Serialization helpers to convert between Supabase snake_case and TypeScript camelCase
 */

import type { Contact, Conversation, Profile, UserPreferences, ConversationSegment, MatchSuggestion, CalendarEvent } from '@shared/schema';

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
    bio: dbRow.bio,
    companyAddress: dbRow.company_address,
    companyEmployees: dbRow.company_employees,
    companyFounded: dbRow.company_founded,
    companyUrl: dbRow.company_url,
    companyLinkedin: dbRow.company_linkedin,
    companyTwitter: dbRow.company_twitter,
    companyFacebook: dbRow.company_facebook,
    companyAngellist: dbRow.company_angellist,
    companyCrunchbase: dbRow.company_crunchbase,
    companyOwler: dbRow.company_owler,
    youtubeVimeo: dbRow.youtube_vimeo,
    isShared: dbRow.is_shared,
    status: dbRow.status || 'verified',
    isInvestor: dbRow.is_investor ?? false,
    contactType: dbRow.contact_type || [],
    checkSizeMin: dbRow.check_size_min,
    checkSizeMax: dbRow.check_size_max,
    investorNotes: dbRow.investor_notes,
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
  
  // Always include fields if they're present (including null to allow clearing)
  if (contact.id !== undefined) dbRow.id = contact.id;
  if (contact.ownedByProfile !== undefined) dbRow.owned_by_profile = contact.ownedByProfile;
  if (contact.name !== undefined) dbRow.name = contact.name;
  if ('firstName' in contact) dbRow.first_name = contact.firstName;
  if ('lastName' in contact) dbRow.last_name = contact.lastName;
  if ('email' in contact) dbRow.email = contact.email;
  if ('company' in contact) dbRow.company = contact.company;
  if ('title' in contact) dbRow.title = contact.title;
  if ('linkedinUrl' in contact) dbRow.linkedin_url = contact.linkedinUrl;
  if ('location' in contact) dbRow.location = contact.location;
  if ('phone' in contact) dbRow.phone = contact.phone;
  if ('category' in contact) dbRow.category = contact.category;
  if ('twitter' in contact) dbRow.twitter = contact.twitter;
  if ('angellist' in contact) dbRow.angellist = contact.angellist;
  if ('bio' in contact) dbRow.bio = contact.bio;
  if ('companyAddress' in contact) dbRow.company_address = contact.companyAddress;
  if ('companyEmployees' in contact) dbRow.company_employees = contact.companyEmployees;
  if ('companyFounded' in contact) dbRow.company_founded = contact.companyFounded;
  if ('companyUrl' in contact) dbRow.company_url = contact.companyUrl;
  if ('companyLinkedin' in contact) dbRow.company_linkedin = contact.companyLinkedin;
  if ('companyTwitter' in contact) dbRow.company_twitter = contact.companyTwitter;
  if ('companyFacebook' in contact) dbRow.company_facebook = contact.companyFacebook;
  if ('companyAngellist' in contact) dbRow.company_angellist = contact.companyAngellist;
  if ('companyCrunchbase' in contact) dbRow.company_crunchbase = contact.companyCrunchbase;
  if ('companyOwler' in contact) dbRow.company_owler = contact.companyOwler;
  if ('youtubeVimeo' in contact) dbRow.youtube_vimeo = contact.youtubeVimeo;
  if (contact.isShared !== undefined) dbRow.is_shared = contact.isShared;
  if (contact.status !== undefined) dbRow.status = contact.status;
  if (contact.isInvestor !== undefined) dbRow.is_investor = contact.isInvestor;
  if ('contactType' in contact) dbRow.contact_type = contact.contactType;
  if ('checkSizeMin' in contact) dbRow.check_size_min = contact.checkSizeMin;
  if ('checkSizeMax' in contact) dbRow.check_size_max = contact.checkSizeMax;
  if ('investorNotes' in contact) dbRow.investor_notes = contact.investorNotes;
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

// ============================================================================
// CALENDAR EVENTS
// ============================================================================

export function calendarEventFromDb(dbRow: any): CalendarEvent {
  return {
    id: dbRow.id,
    ownedByProfile: dbRow.owned_by_profile,
    title: dbRow.title,
    description: dbRow.description,
    startTime: new Date(dbRow.start_time),
    endTime: new Date(dbRow.end_time),
    attendees: dbRow.attendees || [],
    location: dbRow.location,
    meetingUrl: dbRow.meeting_url,
    externalEventId: dbRow.external_event_id,
    createdAt: new Date(dbRow.created_at),
    updatedAt: new Date(dbRow.updated_at),
  };
}

export function calendarEventToDb(event: Partial<CalendarEvent>): any {
  const dbRow: any = {};
  
  if (event.id !== undefined) dbRow.id = event.id;
  if (event.ownedByProfile !== undefined) dbRow.owned_by_profile = event.ownedByProfile;
  if (event.title !== undefined) dbRow.title = event.title;
  if ('description' in event) dbRow.description = event.description;
  if (event.startTime !== undefined) dbRow.start_time = event.startTime.toISOString();
  if (event.endTime !== undefined) dbRow.end_time = event.endTime.toISOString();
  if (event.attendees !== undefined) dbRow.attendees = event.attendees;
  if ('location' in event) dbRow.location = event.location;
  if ('meetingUrl' in event) dbRow.meeting_url = event.meetingUrl;
  if ('externalEventId' in event) dbRow.external_event_id = event.externalEventId;
  
  return dbRow;
}

export function conversationFromDb(dbRow: any): Conversation {
  return {
    id: dbRow.id,
    ownedByProfile: dbRow.owned_by_profile,
    eventId: dbRow.event_id,
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
  if ('eventId' in conversation) dbRow.event_id = conversation.eventId;
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

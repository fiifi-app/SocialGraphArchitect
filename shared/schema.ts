import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, jsonb, integer, boolean, decimal, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // References auth.users(id) in Supabase
  email: text("email").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull().default('user'),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  profileId: uuid("profile_id").primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  autoTranscribe: boolean("auto_transcribe").notNull().default(true),
  notificationEmail: boolean("notification_email").notNull().default(true),
  matchThreshold: integer("match_threshold").notNull().default(2),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// CONTACTS & NETWORK
// ============================================================================

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownedByProfile: uuid("owned_by_profile").references(() => profiles.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  company: text("company"),
  title: text("title"),
  linkedinUrl: text("linkedin_url"),
  location: text("location"),
  phone: text("phone"),
  category: text("category"),
  twitter: text("twitter"),
  angellist: text("angellist"),
  
  // Company information (hidden in "More Information")
  companyAddress: text("company_address"),
  companyEmployees: text("company_employees"),
  companyFounded: text("company_founded"),
  companyUrl: text("company_url"),
  companyLinkedin: text("company_linkedin"),
  companyTwitter: text("company_twitter"),
  companyFacebook: text("company_facebook"),
  companyAngellist: text("company_angellist"),
  companyCrunchbase: text("company_crunchbase"),
  companyOwler: text("company_owler"),
  youtubeVimeo: text("youtube_vimeo"),
  
  isShared: boolean("is_shared").notNull().default(false),
  
  // Contact Type & LP Status
  contactType: text("contact_type", { 
    enum: ['LP', 'GP', 'Angel', 'FamilyOffice', 'Startup', 'Other'] 
  }),
  isLp: boolean("is_lp").notNull().default(false),
  isInvestor: boolean("is_investor").notNull().default(false),
  
  // Investor Profile Fields
  checkSizeMin: integer("check_size_min"),
  checkSizeMax: integer("check_size_max"),
  investorNotes: text("investor_notes"),
  preferredStages: text("preferred_stages").array().default(sql`ARRAY[]::text[]`),
  preferredTeamSizes: text("preferred_team_sizes").array().default(sql`ARRAY[]::text[]`),
  preferredTenure: text("preferred_tenure").array().default(sql`ARRAY[]::text[]`),
  
  // LP Profile Fields
  isFamilyOffice: boolean("is_family_office").notNull().default(false),
  investmentTypes: text("investment_types").array().default(sql`ARRAY[]::text[]`), // 'fund', 'direct', 'co-invest'
  avgCheckSize: integer("avg_check_size"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contactShares = pgTable("contact_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  sharedWithProfile: uuid("shared_with_profile").notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  accessLevel: text("access_level").notNull().default('view'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const theses = pgTable("theses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  sectors: text("sectors").array().notNull().default(sql`ARRAY[]::text[]`),
  stages: text("stages").array().notNull().default(sql`ARRAY[]::text[]`),
  checkSizes: text("check_sizes").array().notNull().default(sql`ARRAY[]::text[]`),
  geos: text("geos").array().notNull().default(sql`ARRAY[]::text[]`),
  personas: text("personas").array().notNull().default(sql`ARRAY[]::text[]`),
  intents: text("intents").array().notNull().default(sql`ARRAY[]::text[]`),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================================
// CONVERSATIONS & TRANSCRIPTS
// ============================================================================

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownedByProfile: uuid("owned_by_profile").notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  title: text("title"),
  durationSeconds: integer("duration_seconds"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  status: text("status").notNull().default('completed'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationParticipants = pgTable("conversation_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationSegments = pgTable("conversation_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  timestampMs: integer("timestamp_ms").notNull(),
  speaker: text("speaker"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationEntities = pgTable("conversation_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(),
  value: text("value").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  contextSnippet: text("context_snippet"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// MATCHING & SUGGESTIONS
// ============================================================================

export const matchSuggestions = pgTable("match_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  score: integer("score").notNull(),
  reasons: jsonb("reasons").notNull().default(sql`'[]'::jsonb`),
  justification: text("justification"),
  status: text("status").notNull().default('pending'), // 'pending' | 'promised' | 'intro_made'
  promiseStatus: text("promise_status").default('general'), // 'general' | 'promised'
  promisedAt: timestamp("promised_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================================
// INTRODUCTIONS (DOUBLE OPT-IN)
// ============================================================================

export const introductionThreads = pgTable("introduction_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  suggestionId: varchar("suggestion_id").notNull().references(() => matchSuggestions.id, { onDelete: 'cascade' }),
  initiatedByProfile: uuid("initiated_by_profile").notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  contactAId: varchar("contact_a_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  contactBId: varchar("contact_b_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  currentStatus: text("current_status").notNull().default('draft'),
  meetingScheduled: boolean("meeting_scheduled").notNull().default(false),
  meetingOutcome: text("meeting_outcome"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const introductionMessages = pgTable("introduction_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => introductionThreads.id, { onDelete: 'cascade' }),
  direction: text("direction").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// RELATIONSHIP TRACKING
// ============================================================================

export const relationshipEvents = pgTable("relationship_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  eventType: text("event_type").notNull(),
  scoreDelta: decimal("score_delta", { precision: 3, scale: 2 }),
  notes: text("notes"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
});

export const relationshipScores = pgTable("relationship_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  contactId: varchar("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  currentScore: decimal("current_score", { precision: 3, scale: 2 }).notNull().default('0.5'),
  lastInteractionAt: timestamp("last_interaction_at"),
  interactionCount: integer("interaction_count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================================================
// INSERT SCHEMAS
// ============================================================================

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  createdAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactShareSchema = createInsertSchema(contactShares).omit({
  id: true,
  createdAt: true,
});

export const insertThesisSchema = createInsertSchema(theses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertConversationParticipantSchema = createInsertSchema(conversationParticipants).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSegmentSchema = createInsertSchema(conversationSegments).omit({
  id: true,
  createdAt: true,
});

export const insertConversationEntitySchema = createInsertSchema(conversationEntities).omit({
  id: true,
  createdAt: true,
});

export const insertMatchSuggestionSchema = createInsertSchema(matchSuggestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntroductionThreadSchema = createInsertSchema(introductionThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntroductionMessageSchema = createInsertSchema(introductionMessages).omit({
  id: true,
  createdAt: true,
});

export const insertRelationshipEventSchema = createInsertSchema(relationshipEvents).omit({
  id: true,
});

export const insertRelationshipScoreSchema = createInsertSchema(relationshipScores).omit({
  id: true,
  updatedAt: true,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type ContactShare = typeof contactShares.$inferSelect;
export type InsertContactShare = z.infer<typeof insertContactShareSchema>;

export type Thesis = typeof theses.$inferSelect;
export type InsertThesis = z.infer<typeof insertThesisSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type InsertConversationParticipant = z.infer<typeof insertConversationParticipantSchema>;

export type ConversationSegment = typeof conversationSegments.$inferSelect;
export type InsertConversationSegment = z.infer<typeof insertConversationSegmentSchema>;

export type ConversationEntity = typeof conversationEntities.$inferSelect;
export type InsertConversationEntity = z.infer<typeof insertConversationEntitySchema>;

export type MatchSuggestion = typeof matchSuggestions.$inferSelect;
export type InsertMatchSuggestion = z.infer<typeof insertMatchSuggestionSchema>;

export type IntroductionThread = typeof introductionThreads.$inferSelect;
export type InsertIntroductionThread = z.infer<typeof insertIntroductionThreadSchema>;

export type IntroductionMessage = typeof introductionMessages.$inferSelect;
export type InsertIntroductionMessage = z.infer<typeof insertIntroductionMessageSchema>;

export type RelationshipEvent = typeof relationshipEvents.$inferSelect;
export type InsertRelationshipEvent = z.infer<typeof insertRelationshipEventSchema>;

export type RelationshipScore = typeof relationshipScores.$inferSelect;
export type InsertRelationshipScore = z.infer<typeof insertRelationshipScoreSchema>;

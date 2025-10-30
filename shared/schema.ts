import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  role: text("role").notNull(),
  org: text("org"),
  geo: text("geo"),
  relationshipStrength: real("relationship_strength").notNull().default(0.5),
  lastInteractionAt: timestamp("last_interaction_at"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  notes: text("notes"),
  privacyLevel: text("privacy_level").notNull().default('private'),
});

export const theses = pgTable("theses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerContactId: varchar("owner_contact_id").references(() => contacts.id),
  stage: text("stage"),
  checkSizeMinUSD: integer("check_size_min_usd"),
  checkSizeMaxUSD: integer("check_size_max_usd"),
  sectors: text("sectors").array().notNull().default(sql`ARRAY[]::text[]`),
  themes: text("themes").array().notNull().default(sql`ARRAY[]::text[]`),
  geos: text("geos").array().notNull().default(sql`ARRAY[]::text[]`),
  why: text("why").notNull(),
  exclusions: text("exclusions").array().notNull().default(sql`ARRAY[]::text[]`),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  participants: text("participants").array().notNull().default(sql`ARRAY[]::text[]`),
  transcript: jsonb("transcript").notNull().default(sql`'[]'::jsonb`),
  entities: jsonb("entities").notNull().default(sql`'[]'::jsonb`),
  summary: jsonb("summary").notNull().default(sql`'{}'::jsonb`),
});

export const suggestions = pgTable("suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  reason: text("reason").notNull(),
  score: integer("score").notNull(),
  evidenceSpans: jsonb("evidence_spans").notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default('Queued'),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
});

export const insertThesisSchema = createInsertSchema(theses).omit({
  id: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  startedAt: true,
});

export const insertSuggestionSchema = createInsertSchema(suggestions).omit({
  id: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

export type InsertThesis = z.infer<typeof insertThesisSchema>;
export type Thesis = typeof theses.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type Suggestion = typeof suggestions.$inferSelect;

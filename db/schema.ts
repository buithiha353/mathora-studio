import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  r2Key: text("r2_key").notNull(),
  status: text("status").notNull().default("UPLOADED"),
  pageCount: integer("page_count").notNull().default(1),
  sharpenProfile: text("sharpen_profile").notNull().default("NONE"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  content: text("content").notNull(),
  latex: text("latex").notNull().default(""),
  grade: integer("grade").notNull().default(9),
  topic: text("topic").notNull(),
  difficulty: text("difficulty").notNull(),
  type: text("type").notNull().default("MULTIPLE_CHOICE"),
  answer: text("answer").notNull().default(""),
  assetCount: integer("asset_count").notNull().default(0),
  sourceDocumentId: text("source_document_id"),
  status: text("status").notNull().default("REVIEWED"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const imageRegions = sqliteTable("image_regions", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  questionId: text("question_id"),
  questionCode: text("question_code").notNull(),
  label: text("label").notNull(),
  regionType: text("region_type").notNull().default("geometry"),
  boxJson: text("box_json").notNull(),
  confidence: integer("confidence").notNull().default(0),
  status: text("status").notNull().default("AWAITING_REVIEW"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  projectId: text("project_id").notNull(),
  cipherText: text("cipher_text").notNull(),
  iv: text("iv").notNull(),
  hint: text("hint").notNull(),
  model: text("model").notNull().default("gemini-3.5-flash"),
  priority: integer("priority").notNull().default(1),
  usageCount: integer("usage_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  status: text("status").notNull().default("ACTIVE"),
  cooldownUntil: text("cooldown_until"),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const processingJobs = sqliteTable("processing_jobs", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull(),
  status: text("status").notNull().default("QUEUED"),
  progress: integer("progress").notNull().default(0),
  stage: text("stage").notNull().default("UPLOAD"),
  keyId: text("key_id"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const exams = sqliteTable("exams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  duration: integer("duration").notNull().default(90),
  totalQuestions: integer("total_questions").notNull(),
  matrixJson: text("matrix_json").notNull(),
  questionIdsJson: text("question_ids_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const illustrations = sqliteTable("illustrations", {
  id: text("id").primaryKey(),
  questionId: text("question_id"),
  prompt: text("prompt").notNull(),
  mode: text("mode").notNull().default("CONTEXTUAL_DIAGRAM"),
  specJson: text("spec_json").notNull(),
  status: text("status").notNull().default("AWAITING_REVIEW"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

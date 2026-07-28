import { requireDb } from "./bindings";

let schemaReady: Promise<void> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'UPLOADED',
    page_count INTEGER NOT NULL DEFAULT 1,
    sharpen_profile TEXT NOT NULL DEFAULT 'NONE',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    content TEXT NOT NULL,
    latex TEXT NOT NULL DEFAULT '',
    grade INTEGER NOT NULL DEFAULT 9,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    answer TEXT NOT NULL DEFAULT '',
    asset_count INTEGER NOT NULL DEFAULT 0,
    source_document_id TEXT,
    status TEXT NOT NULL DEFAULT 'REVIEWED',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS image_regions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    question_id TEXT,
    question_code TEXT NOT NULL,
    label TEXT NOT NULL,
    region_type TEXT NOT NULL DEFAULT 'geometry',
    box_json TEXT NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 1,
    confidence INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AWAITING_REVIEW',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    project_id TEXT NOT NULL,
    cipher_text TEXT NOT NULL,
    iv TEXT NOT NULL,
    hint TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-3.5-flash-lite',
    priority INTEGER NOT NULL DEFAULT 1,
    usage_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    cooldown_until TEXT,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS processing_jobs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    progress INTEGER NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'UPLOAD',
    key_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 90,
    total_questions INTEGER NOT NULL,
    matrix_json TEXT NOT NULL,
    question_ids_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS illustrations (
    id TEXT PRIMARY KEY,
    question_id TEXT,
    prompt TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'CONTEXTUAL_DIAGRAM',
    spec_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AWAITING_REVIEW',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  "CREATE INDEX IF NOT EXISTS questions_topic_idx ON questions(topic)",
  "CREATE INDEX IF NOT EXISTS questions_difficulty_idx ON questions(difficulty)",
  "CREATE INDEX IF NOT EXISTS image_regions_document_idx ON image_regions(document_id, status)",
  "CREATE INDEX IF NOT EXISTS api_keys_status_idx ON api_keys(status, priority)",
  "CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status)",
  `UPDATE api_keys
   SET model = 'gemini-3.5-flash-lite'
   WHERE model NOT IN (
     'gemini-2.5-flash',
     'gemini-3.5-flash-lite',
     'gemini-3.1-flash-lite'
   )`,
  `DELETE FROM exams
   WHERE question_ids_json LIKE '%q-demo-%'`,
  `DELETE FROM questions
   WHERE id IN (
     'q-demo-01',
     'q-demo-02',
     'q-demo-03',
     'q-demo-04',
     'q-demo-05',
     'q-demo-06'
   )`,
];

async function initialize() {
  const db = requireDb();
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  const regionColumns = await db
    .prepare("PRAGMA table_info(image_regions)")
    .all<{ name: string }>();
  if (!regionColumns.results.some((column) => column.name === "page_number")) {
    await db
      .prepare(
        "ALTER TABLE image_regions ADD COLUMN page_number INTEGER NOT NULL DEFAULT 1",
      )
      .run();
  }
}

export async function ensureDatabase() {
  if (!schemaReady) {
    schemaReady = initialize().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
  return requireDb();
}

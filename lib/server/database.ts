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
  `CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    project_id TEXT NOT NULL,
    cipher_text TEXT NOT NULL,
    iv TEXT NOT NULL,
    hint TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
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
  "CREATE INDEX IF NOT EXISTS api_keys_status_idx ON api_keys(status, priority)",
  "CREATE INDEX IF NOT EXISTS documents_status_idx ON documents(status)",
];

const demoQuestions = [
  {
    id: "q-demo-01",
    code: "MTH-001",
    content: "Giải phương trình x² − 5x + 6 = 0.",
    latex: "x^2-5x+6=0",
    topic: "Phương trình bậc hai",
    difficulty: "HIEU",
    answer: "x = 2 hoặc x = 3",
    assetCount: 0,
  },
  {
    id: "q-demo-02",
    code: "MTH-002",
    content: "Một con thuyền đi qua sông rộng 120 m với vận tốc không đổi. Xác định độ dài đường đi khi biết góc lệch 30°.",
    latex: "d=\\frac{120}{\\cos 30^\\circ}",
    topic: "Hệ thức lượng",
    difficulty: "VAN_DUNG",
    answer: "80√3 m",
    assetCount: 1,
  },
  {
    id: "q-demo-03",
    code: "MTH-003",
    content: "Tam giác ABC vuông tại A, có AB = 6 cm và AC = 8 cm. Tính BC.",
    latex: "BC=\\sqrt{AB^2+AC^2}",
    topic: "Định lý Pythagore",
    difficulty: "BIET",
    answer: "10 cm",
    assetCount: 1,
  },
  {
    id: "q-demo-04",
    code: "MTH-004",
    content: "Từ điểm A ngoài đường tròn (O), kẻ hai tiếp tuyến AB và AC. Chứng minh AB = AC.",
    latex: "AB=AC",
    topic: "Đường tròn",
    difficulty: "VAN_DUNG_CAO",
    answer: "Hai tam giác vuông ABO và ACO bằng nhau",
    assetCount: 1,
  },
  {
    id: "q-demo-05",
    code: "MTH-005",
    content: "Cho hàm số y = 2x − 3. Tìm tọa độ giao điểm của đồ thị với trục tung.",
    latex: "y=2x-3",
    topic: "Hàm số bậc nhất",
    difficulty: "HIEU",
    answer: "(0; −3)",
    assetCount: 0,
  },
  {
    id: "q-demo-06",
    code: "MTH-006",
    content: "Một hộp có 5 bi đỏ và 4 bi xanh. Lấy ngẫu nhiên 1 bi. Tính xác suất lấy được bi đỏ.",
    latex: "P=\\frac{5}{9}",
    topic: "Xác suất",
    difficulty: "VAN_DUNG",
    answer: "5/9",
    assetCount: 1,
  },
];

async function initialize() {
  const db = requireDb();
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));

  await db.batch(
    demoQuestions.map((question) =>
      db
        .prepare(
          `INSERT OR REPLACE INTO questions
            (id, code, content, latex, grade, topic, difficulty, type, answer, asset_count, status)
           VALUES (?, ?, ?, ?, 9, ?, ?, 'MULTIPLE_CHOICE', ?, ?, 'REVIEWED')`,
        )
        .bind(
          question.id,
          question.code,
          question.content,
          question.latex,
          question.topic,
          question.difficulty,
          question.answer,
          question.assetCount,
        ),
    ),
  );
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

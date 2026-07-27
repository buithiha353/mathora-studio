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
    grade INTEGER NOT NULL DEFAULT 12,
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
    content: "Cho hàm số y = x³ − 3x + 1. Tìm các điểm cực trị của hàm số.",
    latex: "y=x^3-3x+1",
    topic: "Hàm số",
    difficulty: "HIEU",
    answer: "x = ±1",
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
    content: "Tính tích phân ∫₀¹(3x² + 2x)dx.",
    latex: "\\int_0^1(3x^2+2x)\\,dx",
    topic: "Nguyên hàm – Tích phân",
    difficulty: "BIET",
    answer: "2",
    assetCount: 0,
  },
  {
    id: "q-demo-04",
    code: "MTH-004",
    content: "Cho hình chóp S.ABCD có đáy là hình vuông cạnh a, SA vuông góc với đáy. Tính góc giữa SC và mặt đáy.",
    latex: "SA\\perp(ABCD)",
    topic: "Hình học không gian",
    difficulty: "VAN_DUNG_CAO",
    answer: "Theo dữ kiện SA",
    assetCount: 1,
  },
  {
    id: "q-demo-05",
    code: "MTH-005",
    content: "Giải phương trình log₂(x − 1) + log₂(x + 1) = 3.",
    latex: "\\log_2(x-1)+\\log_2(x+1)=3",
    topic: "Mũ – Logarit",
    difficulty: "HIEU",
    answer: "x = 3",
    assetCount: 0,
  },
  {
    id: "q-demo-06",
    code: "MTH-006",
    content: "Một hộp có 5 bi đỏ và 4 bi xanh. Lấy ngẫu nhiên 2 bi. Tính xác suất lấy được hai bi cùng màu.",
    latex: "P=\\frac{C_5^2+C_4^2}{C_9^2}",
    topic: "Xác suất",
    difficulty: "VAN_DUNG",
    answer: "4/9",
    assetCount: 1,
  },
];

async function initialize() {
  const db = requireDb();
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));

  const count = await db
    .prepare("SELECT COUNT(*) AS total FROM questions")
    .first<{ total: number }>();

  if (Number(count?.total ?? 0) === 0) {
    await db.batch(
      demoQuestions.map((question) =>
        db
          .prepare(
            `INSERT INTO questions
              (id, code, content, latex, grade, topic, difficulty, type, answer, asset_count, status)
             VALUES (?, ?, ?, ?, 12, ?, ?, 'MULTIPLE_CHOICE', ?, ?, 'REVIEWED')`,
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

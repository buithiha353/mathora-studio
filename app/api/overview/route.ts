import { ensureDatabase } from "@/lib/server/database";

export async function GET() {
  try {
    const db = await ensureDatabase();
    const [documents, questions, exams, apiKeys, latestQuestions] =
      await Promise.all([
        db.prepare("SELECT COUNT(*) AS total FROM documents").first<{ total: number }>(),
        db.prepare("SELECT COUNT(*) AS total FROM questions").first<{ total: number }>(),
        db.prepare("SELECT COUNT(*) AS total FROM exams").first<{ total: number }>(),
        db
          .prepare("SELECT COUNT(*) AS total FROM api_keys WHERE status = 'ACTIVE'")
          .first<{ total: number }>(),
        db
          .prepare(
            `SELECT id, code, content, latex, grade, topic, difficulty, type,
                    answer, asset_count AS assetCount, status, created_at AS createdAt
             FROM questions
             ORDER BY created_at DESC, code ASC
             LIMIT 30`,
          )
          .all(),
      ]);

    return Response.json({
      metrics: {
        documents: Number(documents?.total ?? 0),
        questions: Number(questions?.total ?? 0),
        exams: Number(exams?.total ?? 0),
        activeKeys: Number(apiKeys?.total ?? 0),
      },
      questions: latestQuestions.results,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tải dữ liệu." },
      { status: 500 },
    );
  }
}

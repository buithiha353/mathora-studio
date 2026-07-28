import { ensureDatabase } from "@/lib/server/database";

export async function GET() {
  try {
    const db = await ensureDatabase();
    const [documents, questions, exams, apiKeys, latestQuestions, imageRegions] =
      await Promise.all([
        db.prepare("SELECT COUNT(*) AS total FROM documents").first<{ total: number }>(),
        db
          .prepare("SELECT COUNT(*) AS total FROM questions WHERE status = 'REVIEWED'")
          .first<{ total: number }>(),
        db.prepare("SELECT COUNT(*) AS total FROM exams").first<{ total: number }>(),
        db
          .prepare("SELECT COUNT(*) AS total FROM api_keys WHERE status = 'ACTIVE'")
          .first<{ total: number }>(),
        db
          .prepare(
            `SELECT id, code, content, latex, grade, topic, difficulty, type,
                    answer, asset_count AS assetCount, status, created_at AS createdAt
             FROM questions
             WHERE status = 'REVIEWED'
             ORDER BY created_at DESC, code ASC
             LIMIT 30`,
          )
          .all(),
        db
          .prepare(
            `SELECT id, question_id AS questionId, label,
                    region_type AS regionType, box_json AS boxJson,
                    page_number AS page
             FROM image_regions
             WHERE status = 'CONFIRMED' AND question_id IS NOT NULL
             ORDER BY created_at ASC`,
          )
          .all<Record<string, unknown>>(),
      ]);

    const assetsByQuestion = new Map<string, Record<string, unknown>[]>();
    for (const region of imageRegions.results) {
      const questionId = String(region.questionId ?? "");
      if (!questionId) continue;
      const asset = {
        id: String(region.id),
        label: String(region.label),
        regionType: String(region.regionType),
        box: JSON.parse(String(region.boxJson ?? "[]")),
        page: Math.max(1, Number(region.page) || 1),
        sourceUrl: `/api/region-image?regionId=${encodeURIComponent(String(region.id))}`,
      };
      assetsByQuestion.set(questionId, [
        ...(assetsByQuestion.get(questionId) ?? []),
        asset,
      ]);
    }

    return Response.json({
      metrics: {
        documents: Number(documents?.total ?? 0),
        questions: Number(questions?.total ?? 0),
        exams: Number(exams?.total ?? 0),
        activeKeys: Number(apiKeys?.total ?? 0),
      },
      questions: latestQuestions.results.map((question) => {
        const id = String((question as { id?: unknown }).id ?? "");
        const assets = assetsByQuestion.get(id) ?? [];
        return { ...question, assetCount: assets.length, assets };
      }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tải dữ liệu." },
      { status: 500 },
    );
  }
}

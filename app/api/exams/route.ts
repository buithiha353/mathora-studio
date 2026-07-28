import { ensureDatabase } from "@/lib/server/database";

type Matrix = Record<string, number>;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      title?: string;
      duration?: number;
      totalQuestions?: number;
      grade?: number;
      difficulty?: Matrix;
    };
    const totalQuestions = Math.max(
      1,
      Math.min(100, Number(payload.totalQuestions ?? 10)),
    );
    const grade = Math.min(9, Math.max(6, Number(payload.grade) || 9));
    const db = await ensureDatabase();
    const rows = await db
      .prepare(
        `SELECT id, code, content, latex, topic, difficulty, answer,
                asset_count AS assetCount
         FROM questions
         WHERE grade = ? AND status = 'REVIEWED'
         ORDER BY RANDOM()`,
      )
      .bind(grade)
      .all<Record<string, unknown>>();

    const requested = payload.difficulty ?? {};
    const selected: Record<string, unknown>[] = [];
    const buckets = new Map<string, Record<string, unknown>[]>();
    for (const row of rows.results) {
      const difficulty = String(row.difficulty);
      buckets.set(difficulty, [...(buckets.get(difficulty) ?? []), row]);
    }

    for (const [difficulty, count] of Object.entries(requested)) {
      selected.push(...(buckets.get(difficulty) ?? []).slice(0, Number(count)));
    }

    for (const row of rows.results) {
      if (selected.length >= totalQuestions) break;
      if (!selected.some((item) => item.id === row.id)) selected.push(row);
    }

    const finalQuestions = selected.slice(0, totalQuestions);
    const selectedIds = finalQuestions.map((question) => String(question.id));
    const regions =
      selectedIds.length > 0
        ? await db
            .prepare(
              `SELECT id, question_id AS questionId, label,
                      region_type AS regionType, box_json AS boxJson,
                      page_number AS page
               FROM image_regions
               WHERE status = 'CONFIRMED'
                 AND question_id IN (${selectedIds.map(() => "?").join(",")})
               ORDER BY created_at ASC`,
            )
            .bind(...selectedIds)
            .all<Record<string, unknown>>()
        : { results: [] };
    const assetsByQuestion = new Map<string, Record<string, unknown>[]>();
    for (const region of regions.results) {
      const questionId = String(region.questionId ?? "");
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
    const finalQuestionsWithAssets = finalQuestions.map((question) => {
      const assets = assetsByQuestion.get(String(question.id)) ?? [];
      return {
        ...question,
        id: String(question.id),
        assetCount: assets.length,
        assets,
      };
    });
    const id = crypto.randomUUID();
    const title = payload.title?.trim() || "Đề luyện tập Toán";
    const duration = Math.max(15, Math.min(240, Number(payload.duration ?? 90)));
    await db
      .prepare(
        `INSERT INTO exams
          (id, title, duration, total_questions, matrix_json, question_ids_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        title,
        duration,
        finalQuestionsWithAssets.length,
        JSON.stringify(requested),
        JSON.stringify(finalQuestionsWithAssets.map((question) => question.id)),
      )
      .run();

    return Response.json({
      exam: { id, title, duration, questions: finalQuestionsWithAssets },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tạo đề." },
      { status: 500 },
    );
  }
}

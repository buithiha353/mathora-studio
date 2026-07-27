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
         ORDER BY created_at DESC`,
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
        finalQuestions.length,
        JSON.stringify(requested),
        JSON.stringify(finalQuestions.map((question) => question.id)),
      )
      .run();

    return Response.json({
      exam: { id, title, duration, questions: finalQuestions },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tạo đề." },
      { status: 500 },
    );
  }
}

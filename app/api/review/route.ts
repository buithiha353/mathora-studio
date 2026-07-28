import { ensureDatabase } from "@/lib/server/database";

const difficulties = new Set([
  "BIET",
  "HIEU",
  "VAN_DUNG",
  "VAN_DUNG_CAO",
]);
const regionTypes = new Set(["geometry", "chart", "table", "formula"]);

type ReviewQuestion = {
  id: string;
  code: string;
  content: string;
  latex?: string;
  grade: number;
  topic: string;
  difficulty: string;
  answer?: string;
  assetCount?: number;
};

type ReviewRegion = {
  id: string;
  label: string;
  regionType: string;
  box: number[];
  page?: number;
  questionId?: string | null;
  questionCode: string;
};

export async function GET(request: Request) {
  try {
    const documentId = new URL(request.url).searchParams.get("documentId");
    if (!documentId) {
      return Response.json({ error: "Thiếu tài liệu cần duyệt." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const [document, questions, regions] = await Promise.all([
      db
        .prepare(
          `SELECT id, name, status, page_count AS pages
           FROM documents WHERE id = ?`,
        )
        .bind(documentId)
        .first(),
      db
        .prepare(
          `SELECT id, code, content, latex, grade, topic, difficulty, type,
                  answer, asset_count AS assetCount, status
           FROM questions WHERE source_document_id = ?
           ORDER BY code ASC`,
        )
        .bind(documentId)
        .all(),
      db
        .prepare(
          `SELECT id, question_id AS questionId, question_code AS questionCode,
                  label, region_type AS regionType, box_json AS boxJson,
                  page_number AS page, confidence, status
           FROM image_regions WHERE document_id = ?
           ORDER BY created_at ASC`,
        )
        .bind(documentId)
        .all<Record<string, unknown>>(),
    ]);

    if (!document) {
      return Response.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
    }

    return Response.json({
      document,
      questions: questions.results,
      regions: regions.results.map((region) => ({
        ...region,
        box: JSON.parse(String(region.boxJson ?? "[]")),
        confidence: Number(region.confidence ?? 0) / 10000,
        boxJson: undefined,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tải phiên duyệt." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      documentId?: string;
      questions?: ReviewQuestion[];
      regions?: ReviewRegion[];
      confirmedQuestionIds?: string[];
      confirmedRegionIds?: string[];
    };
    const documentId = payload.documentId?.trim();
    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    const regions = Array.isArray(payload.regions) ? payload.regions : [];
    if (!documentId || questions.length === 0) {
      return Response.json(
        { error: "Phiên duyệt chưa có đủ tài liệu và câu hỏi." },
        { status: 400 },
      );
    }

    const db = await ensureDatabase();
    const [document, storedQuestions, storedRegions] = await Promise.all([
      db
        .prepare("SELECT id FROM documents WHERE id = ?")
        .bind(documentId)
        .first(),
      db
        .prepare("SELECT id FROM questions WHERE source_document_id = ?")
        .bind(documentId)
        .all<{ id: string }>(),
      db
        .prepare("SELECT id FROM image_regions WHERE document_id = ?")
        .bind(documentId)
        .all<{ id: string }>(),
    ]);
    if (!document) {
      return Response.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
    }

    const storedQuestionIds = new Set(
      storedQuestions.results.map((item) => item.id),
    );
    const storedRegionIds = new Set(storedRegions.results.map((item) => item.id));
    const submittedQuestionIds = new Set(questions.map((item) => item.id));
    const submittedRegionIds = new Set(regions.map((item) => item.id));
    const confirmedQuestionIds = new Set(payload.confirmedQuestionIds ?? []);
    const confirmedRegionIds = new Set(payload.confirmedRegionIds ?? []);

    const coversAllQuestions =
      storedQuestionIds.size === submittedQuestionIds.size &&
      [...storedQuestionIds].every(
        (id) => submittedQuestionIds.has(id) && confirmedQuestionIds.has(id),
      );
    const coversAllRegions =
      storedRegionIds.size === submittedRegionIds.size &&
      [...storedRegionIds].every(
        (id) => submittedRegionIds.has(id) && confirmedRegionIds.has(id),
      );
    if (!coversAllQuestions || !coversAllRegions) {
      return Response.json(
        { error: "Hãy xác nhận đủ câu hỏi và vùng ảnh trước khi nhập thư viện." },
        { status: 409 },
      );
    }

    for (const question of questions) {
      if (
        !storedQuestionIds.has(question.id) ||
        !question.code?.trim() ||
        !question.content?.trim() ||
        !question.topic?.trim() ||
        !difficulties.has(question.difficulty)
      ) {
        return Response.json(
          { error: "Có câu hỏi thiếu nội dung hoặc phân loại hợp lệ." },
          { status: 400 },
        );
      }
    }
    for (const region of regions) {
      if (
        !storedRegionIds.has(region.id) ||
        !region.label?.trim() ||
        !regionTypes.has(region.regionType) ||
        !Array.isArray(region.box) ||
        region.box.length !== 4 ||
        !region.questionId ||
        !storedQuestionIds.has(region.questionId)
      ) {
        return Response.json(
          { error: "Có vùng ảnh chưa được gắn hoặc phân loại hợp lệ." },
          { status: 400 },
        );
      }
    }

    await db.batch([
      ...questions.map((question) =>
        db
          .prepare(
            `UPDATE questions
             SET code = ?, content = ?, latex = ?, grade = ?, topic = ?,
                 difficulty = ?, answer = ?, asset_count = ?, status = 'REVIEWED'
             WHERE id = ? AND source_document_id = ?`,
          )
          .bind(
            question.code.trim(),
            question.content.trim(),
            question.latex?.trim() ?? "",
            Math.min(9, Math.max(6, Number(question.grade) || 9)),
            question.topic.trim(),
            question.difficulty,
            question.answer?.trim() ?? "",
            Math.max(0, Number(question.assetCount) || 0),
            question.id,
            documentId,
          ),
      ),
      ...regions.map((region) =>
        db
          .prepare(
            `UPDATE image_regions
             SET question_id = ?, question_code = ?, label = ?, region_type = ?,
                 box_json = ?, page_number = ?, status = 'CONFIRMED'
             WHERE id = ? AND document_id = ?`,
          )
          .bind(
            region.questionId ?? null,
            region.questionCode.trim(),
            region.label.trim(),
            region.regionType,
            JSON.stringify(
              region.box.map((value) =>
                Math.max(0, Math.min(100, Number(value) || 0)),
              ),
            ),
            Math.max(1, Number(region.page) || 1),
            region.id,
            documentId,
          ),
      ),
      db
        .prepare("UPDATE documents SET status = 'COMPLETED' WHERE id = ?")
        .bind(documentId),
    ]);

    return Response.json({
      reviewed: {
        questions: questions.length,
        regions: regions.length,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể hoàn tất duyệt." },
      { status: 500 },
    );
  }
}

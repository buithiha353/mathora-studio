import { demoOcrResult } from "@/lib/demo-data";
import { requireFiles } from "@/lib/server/bindings";
import { ensureDatabase } from "@/lib/server/database";
import {
  callGeminiStructured,
  NoGeminiKeyError,
} from "@/lib/server/gemini";

const ocrSchema = {
  type: "OBJECT",
  properties: {
    document: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        pages: { type: "INTEGER" },
        confidence: { type: "NUMBER" },
      },
      required: ["name", "pages", "confidence"],
    },
    imageRegions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          label: { type: "STRING" },
          box: { type: "ARRAY", items: { type: "NUMBER" } },
          questionCode: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["id", "label", "box", "questionCode", "confidence"],
      },
    },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          code: { type: "STRING" },
          grade: { type: "INTEGER" },
          content: { type: "STRING" },
          latex: { type: "STRING" },
          topic: { type: "STRING" },
          difficulty: {
            type: "STRING",
            enum: ["BIET", "HIEU", "VAN_DUNG", "VAN_DUNG_CAO"],
          },
          confidence: { type: "NUMBER" },
          assetCount: { type: "INTEGER" },
        },
        required: [
          "code",
          "grade",
          "content",
          "latex",
          "topic",
          "difficulty",
          "confidence",
          "assetCount",
        ],
      },
    },
  },
  required: ["document", "imageRegions", "questions"],
};

type OcrQuestion = {
  id?: string;
  code: string;
  grade: number;
  content: string;
  latex: string;
  topic: string;
  difficulty: string;
  confidence: number;
  assetCount: number;
};

type OcrRegion = {
  id?: string;
  label: string;
  box: number[];
  questionCode: string;
  questionId?: string | null;
  regionType?: string;
  confidence: number;
};

type OcrResult = {
  document: { name: string; pages: number; confidence: number };
  imageRegions: OcrRegion[];
  questions: OcrQuestion[];
};

function normalizeConfidence(value: number) {
  const numeric = Number(value) || 0;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}

function inferRegionType(label: string) {
  const normalized = label.toLocaleLowerCase("vi");
  if (normalized.includes("bảng")) return "table";
  if (normalized.includes("đồ thị") || normalized.includes("biểu đồ")) return "chart";
  if (normalized.includes("công thức")) return "formula";
  return "geometry";
}

export async function POST(request: Request) {
  try {
    const { documentId } = (await request.json()) as { documentId?: string };
    if (!documentId) {
      return Response.json({ error: "Thiếu tài liệu cần xử lý." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const document = await db
      .prepare(
        `SELECT id, name, mime_type AS mimeType, size, r2_key AS r2Key
         FROM documents WHERE id = ?`,
      )
      .bind(documentId)
      .first<{
        id: string;
        name: string;
        mimeType: string;
        size: number;
        r2Key: string;
      }>();
    if (!document) {
      return Response.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
    }
    if (document.size > 18 * 1024 * 1024) {
      return Response.json(
        {
          error:
            "MVP xử lý trực tiếp tệp tối đa 18 MB. Tệp lớn hơn sẽ dùng Files API ở bản tiếp theo.",
        },
        { status: 413 },
      );
    }

    const object = await requireFiles().get(document.r2Key);
    if (!object) {
      return Response.json({ error: "Không tìm thấy tệp nguồn." }, { status: 404 });
    }
    const bytes = new Uint8Array(await object.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary);

    let result: OcrResult;
    let mode = "gemini";
    let model: string | null = null;

    try {
      const response = await callGeminiStructured({
        mimeType: document.mimeType,
        data: base64,
        schema: ocrSchema,
        prompt: `Bạn là hệ thống OCR đề thi Toán THCS tiếng Việt dành cho các lớp 6, 7, 8 và 9.
Đọc tài liệu theo thứ tự thị giác. Bảo toàn mọi công thức dưới dạng LaTeX.
Phát hiện vùng hình học, đồ thị, bảng và hình minh họa bằng box [ymin, xmin, ymax, xmax] chuẩn hóa 0-100.
Tách chính xác từng câu hỏi, xác định khối lớp từ 6 đến 9, phân loại theo mảng kiến thức Toán THCS và độ khó theo bốn mức BIET, HIEU, VAN_DUNG, VAN_DUNG_CAO.
Không tự sửa hoặc bổ sung dữ kiện không nhìn thấy. Tên tài liệu là "${document.name}".`,
      });
      result = response.data as OcrResult;
      model = response.model;
    } catch (error) {
      if (!(error instanceof NoGeminiKeyError)) throw error;
      result = {
        ...demoOcrResult,
        document: { ...demoOcrResult.document, name: document.name },
      };
      mode = "demo";
    }

    const questions = (Array.isArray(result.questions) ? result.questions : []).map(
      (question, index) => ({
        ...question,
        id: `${documentId}-q-${index + 1}`,
        grade: Math.min(9, Math.max(6, Number(question.grade) || 9)),
        confidence: normalizeConfidence(question.confidence),
        assetCount: Math.max(0, Number(question.assetCount) || 0),
      }),
    );
    const questionIds = new Map(
      questions.map((question) => [question.code, question.id]),
    );
    const imageRegions = (
      Array.isArray(result.imageRegions) ? result.imageRegions : []
    ).map((region, index) => ({
      ...region,
      id: `${documentId}-r-${index + 1}`,
      box: Array.from({ length: 4 }, (_, boxIndex) =>
        Math.max(0, Math.min(100, Number(region.box?.[boxIndex]) || 0)),
      ),
      questionId: questionIds.get(region.questionCode) ?? null,
      regionType: inferRegionType(region.label),
      confidence: normalizeConfidence(region.confidence),
    }));
    result = { ...result, questions, imageRegions };

    await db.batch(
      [
        db
          .prepare("DELETE FROM image_regions WHERE document_id = ?")
          .bind(documentId),
        db
          .prepare("DELETE FROM questions WHERE source_document_id = ?")
          .bind(documentId),
        ...questions.map((question) =>
          db
            .prepare(
              `INSERT INTO questions
              (id, code, content, latex, grade, topic, difficulty, type,
               answer, asset_count, source_document_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'MULTIPLE_CHOICE', '', ?, ?, 'AWAITING_REVIEW')`,
            )
            .bind(
              question.id,
              question.code,
              question.content,
              question.latex,
              question.grade,
              question.topic,
              question.difficulty,
              question.assetCount,
              documentId,
            ),
        ),
        ...imageRegions.map((region) =>
          db
            .prepare(
              `INSERT INTO image_regions
                (id, document_id, question_id, question_code, label, region_type,
                 box_json, confidence, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AWAITING_REVIEW')`,
            )
            .bind(
              region.id,
              documentId,
              region.questionId,
              region.questionCode,
              region.label,
              region.regionType,
              JSON.stringify(region.box),
              Math.round(region.confidence * 10000),
            ),
        ),
        db
          .prepare(
            "UPDATE documents SET status = 'REGION_REVIEW', page_count = ? WHERE id = ?",
          )
          .bind(result.document.pages || 1, documentId),
      ],
    );

    return Response.json({ result, mode, model });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể xử lý tài liệu.",
      },
      { status: 500 },
    );
  }
}

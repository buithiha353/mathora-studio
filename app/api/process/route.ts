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
  code: string;
  content: string;
  latex: string;
  topic: string;
  difficulty: string;
  confidence: number;
  assetCount: number;
};

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

    let result: typeof demoOcrResult;
    let mode = "gemini";
    let model: string | null = null;

    try {
      const response = await callGeminiStructured({
        mimeType: document.mimeType,
        data: base64,
        schema: ocrSchema,
        prompt: `Bạn là hệ thống OCR đề thi Toán tiếng Việt.
Đọc tài liệu theo thứ tự thị giác. Bảo toàn mọi công thức dưới dạng LaTeX.
Phát hiện vùng hình học, đồ thị, bảng và hình minh họa bằng box [ymin, xmin, ymax, xmax] chuẩn hóa 0-100.
Tách chính xác từng câu hỏi, phân loại chủ đề và độ khó theo bốn mức BIET, HIEU, VAN_DUNG, VAN_DUNG_CAO.
Không tự sửa hoặc bổ sung dữ kiện không nhìn thấy. Tên tài liệu là "${document.name}".`,
      });
      result = response.data as typeof demoOcrResult;
      model = response.model;
    } catch (error) {
      if (!(error instanceof NoGeminiKeyError)) throw error;
      result = {
        ...demoOcrResult,
        document: { ...demoOcrResult.document, name: document.name },
      };
      mode = "demo";
    }

    const questions = Array.isArray(result.questions) ? result.questions : [];
    await db.batch(
      questions.map((question: OcrQuestion, index: number) =>
        db
          .prepare(
            `INSERT OR REPLACE INTO questions
              (id, code, content, latex, grade, topic, difficulty, type,
               answer, asset_count, source_document_id, status)
             VALUES (?, ?, ?, ?, 12, ?, ?, 'MULTIPLE_CHOICE', '', ?, ?, 'AWAITING_REVIEW')`,
          )
          .bind(
            `${documentId}-q-${index + 1}`,
            question.code,
            question.content,
            question.latex,
            question.topic,
            question.difficulty,
            question.assetCount,
            documentId,
          ),
      ),
    );
    await db
      .prepare(
        "UPDATE documents SET status = 'REGION_REVIEW', page_count = ? WHERE id = ?",
      )
      .bind(result.document.pages || 1, documentId)
      .run();

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

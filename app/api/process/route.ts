import { demoOcrResult } from "@/lib/demo-data";
import { buildDocumentLayoutPrompt } from "@/lib/layout-prompt";
import { requireFiles } from "@/lib/server/bindings";
import { ensureDatabase } from "@/lib/server/database";
import {
  callGeminiStructured,
  NoGeminiKeyError,
} from "@/lib/server/gemini";

const layoutRegionTypes = [
  "TITLE",
  "SECTION",
  "QUESTION_NUMBER",
  "TEXT",
  "FORMULA",
  "IMAGE",
  "TABLE",
  "GRAPH",
  "GEOMETRY",
  "DIAGRAM",
  "FOOTNOTE",
  "HEADER",
  "FOOTER",
  "UNKNOWN",
];

const layoutSchema = {
  type: "OBJECT",
  properties: {
    page: { type: "INTEGER" },
    width: { type: "INTEGER" },
    height: { type: "INTEGER" },
    regions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          type: { type: "STRING", enum: layoutRegionTypes },
          bbox: {
            type: "OBJECT",
            properties: {
              left: { type: "INTEGER" },
              top: { type: "INTEGER" },
              right: { type: "INTEGER" },
              bottom: { type: "INTEGER" },
            },
            required: ["left", "top", "right", "bottom"],
          },
          confidence: { type: "NUMBER" },
          need_review: { type: "BOOLEAN" },
        },
        required: ["id", "type", "bbox", "confidence", "need_review"],
      },
    },
  },
  required: ["page", "width", "height", "regions"],
};

const contentOcrSchema = {
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

type LayoutRegion = {
  id: string;
  type: string;
  bbox: { left: number; top: number; right: number; bottom: number };
  confidence: number;
  need_review: boolean;
};

type LayoutMap = {
  page: number;
  width: number;
  height: number;
  regions: LayoutRegion[];
};

function normalizeLayoutMap(input: LayoutMap): LayoutMap {
  const width = Math.max(1, Math.round(Number(input.width) || 1));
  const height = Math.max(1, Math.round(Number(input.height) || 1));
  const seenIds = new Set<string>();
  const regions = (Array.isArray(input.regions) ? input.regions : [])
    .map((region, index) => {
      const confidence = normalizeConfidence(region.confidence);
      const baseId = String(region.id || `${region.type}_${index + 1}`);
      let id = baseId;
      let suffix = 2;
      while (seenIds.has(id)) {
        id = `${baseId}_${suffix}`;
        suffix += 1;
      }
      seenIds.add(id);

      const left = Math.max(
        0,
        Math.min(width, Math.round(Number(region.bbox?.left) || 0)),
      );
      const top = Math.max(
        0,
        Math.min(height, Math.round(Number(region.bbox?.top) || 0)),
      );
      const right = Math.max(
        left,
        Math.min(width, Math.round(Number(region.bbox?.right) || left)),
      );
      const bottom = Math.max(
        top,
        Math.min(height, Math.round(Number(region.bbox?.bottom) || top)),
      );

      return {
        id,
        type: layoutRegionTypes.includes(region.type) ? region.type : "UNKNOWN",
        bbox: { left, top, right, bottom },
        confidence,
        need_review: confidence < 0.95,
      };
    })
    .sort(
      (a, b) =>
        a.bbox.top - b.bbox.top ||
        a.bbox.left - b.bbox.left ||
        a.bbox.bottom - b.bbox.bottom,
    );

  return {
    page: Math.max(1, Math.round(Number(input.page) || 1)),
    width,
    height,
    regions,
  };
}

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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function layoutRegionType(type: string) {
  if (type === "TABLE") return "table";
  if (type === "GRAPH") return "chart";
  if (type === "FORMULA") return "formula";
  return "geometry";
}

function reviewRegionsFromLayout(layout: LayoutMap): OcrRegion[] {
  const reviewTypes = new Set([
    "FORMULA",
    "IMAGE",
    "TABLE",
    "GRAPH",
    "GEOMETRY",
    "DIAGRAM",
  ]);
  const width = Math.max(1, Number(layout.width) || 1);
  const height = Math.max(1, Number(layout.height) || 1);

  return (Array.isArray(layout.regions) ? layout.regions : [])
    .filter((region) => reviewTypes.has(region.type))
    .map((region) => ({
      id: region.id,
      label: region.type,
      box: [
        clampPercent((Number(region.bbox?.top) / height) * 100),
        clampPercent((Number(region.bbox?.left) / width) * 100),
        clampPercent((Number(region.bbox?.bottom) / height) * 100),
        clampPercent((Number(region.bbox?.right) / width) * 100),
      ],
      questionCode: "",
      regionType: layoutRegionType(region.type),
      confidence: normalizeConfidence(region.confidence),
    }));
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
    let layoutMap: LayoutMap | null = null;
    let mode = "gemini";
    let model: string | null = null;

    try {
      const layoutResponse = await callGeminiStructured({
        mimeType: document.mimeType,
        data: base64,
        schema: layoutSchema,
        prompt: buildDocumentLayoutPrompt(1),
      });
      layoutMap = normalizeLayoutMap(layoutResponse.data as LayoutMap);

      const response = await callGeminiStructured({
        model: layoutResponse.model,
        mimeType: document.mimeType,
        data: base64,
        schema: contentOcrSchema,
        prompt: `Bạn là hệ thống OCR đề thi Toán THCS tiếng Việt dành cho các lớp 6, 7, 8 và 9.
Đây là bước OCR nội dung chạy SAU bước Document Layout AI. Đọc theo đúng thứ tự và ranh giới vùng trong Layout Map dưới đây. Bảo toàn mọi công thức dưới dạng LaTeX.
Không thay đổi bbox của Layout Map và không gộp các vùng khác loại.
Tách chính xác từng câu hỏi, xác định khối lớp từ 6 đến 9, phân loại theo mảng kiến thức Toán THCS và độ khó theo bốn mức BIET, HIEU, VAN_DUNG, VAN_DUNG_CAO.
Không tự sửa hoặc bổ sung dữ kiện không nhìn thấy. Tên tài liệu là "${document.name}".

Layout Map:
${JSON.stringify(layoutMap)}`,
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
    const detectedRegions = layoutMap
      ? reviewRegionsFromLayout(layoutMap)
      : Array.isArray(result.imageRegions)
        ? result.imageRegions
        : [];
    const imageRegions = detectedRegions.map((region, index) => ({
      ...region,
      id: `${documentId}-r-${index + 1}`,
      box: Array.from({ length: 4 }, (_, boxIndex) =>
        Math.max(0, Math.min(100, Number(region.box?.[boxIndex]) || 0)),
      ),
      questionId: questionIds.get(region.questionCode) ?? null,
      regionType: region.regionType ?? inferRegionType(region.label),
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

    return Response.json({ result, layoutMap, mode, model });
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

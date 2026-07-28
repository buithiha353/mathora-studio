import { demoOcrResult } from "@/lib/demo-data";
import { normalizeToggleTex } from "@/lib/latex";
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
  page?: number;
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

function normalizeLayoutMap(
  input: LayoutMap,
  expectedSize?: { width: number; height: number },
): LayoutMap {
  const width = Math.max(
    1,
    Math.round(Number(expectedSize?.width ?? input.width) || 1),
  );
  const height = Math.max(
    1,
    Math.round(Number(expectedSize?.height ?? input.height) || 1),
  );
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
      page: layout.page,
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

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

type SourcePage = {
  pageNumber: number;
  mimeType: string;
  base64: string;
  width?: number;
  height?: number;
};

async function loadDimensions(key: string) {
  try {
    const object = await requireFiles().get(key);
    if (!object) return undefined;
    const data = JSON.parse(
      new TextDecoder().decode(await object.arrayBuffer()),
    ) as { width?: number; height?: number };
    const width = Math.round(Number(data.width) || 0);
    const height = Math.round(Number(data.height) || 0);
    return width > 0 && height > 0 ? { width, height } : undefined;
  } catch {
    return undefined;
  }
}

async function loadSourcePages(document: {
  id: string;
  mimeType: string;
  size: number;
  r2Key: string;
  pageCount: number;
}) {
  const files = requireFiles();
  if (document.mimeType === "application/pdf") {
    const pages: SourcePage[] = [];
    for (let pageNumber = 1; pageNumber <= document.pageCount; pageNumber += 1) {
      const pageKey = `documents/${document.id}/pages/page-${String(pageNumber).padStart(4, "0")}.png`;
      const pageObject = await files.get(pageKey);
      if (!pageObject) {
        throw new Error(
          `Thiếu ảnh PNG của trang ${pageNumber}. Hãy tải lại file PDF để hệ thống tách trang.`,
        );
      }
      const pageBytes = new Uint8Array(await pageObject.arrayBuffer());
      if (pageBytes.byteLength > 18 * 1024 * 1024) {
        throw new Error(`Ảnh trang ${pageNumber} vượt quá giới hạn 18 MB.`);
      }
      pages.push({
        pageNumber,
        mimeType: "image/png",
        base64: bytesToBase64(pageBytes),
        ...(await loadDimensions(`${pageKey}.json`)),
      });
    }
    return pages;
  }

  if (document.size > 18 * 1024 * 1024) {
    throw new Error("Ảnh nguồn vượt quá giới hạn xử lý trực tiếp 18 MB.");
  }
  const object = await files.get(document.r2Key);
  if (!object) {
    throw new Error("Không tìm thấy tệp nguồn.");
  }
  const bytes = new Uint8Array(await object.arrayBuffer());
  const sourceDimensions = await loadDimensions(
    `documents/${document.id}/source-dimensions.json`,
  );
  return [
    {
      pageNumber: 1,
      mimeType: document.mimeType,
      base64: bytesToBase64(bytes),
      ...sourceDimensions,
    },
  ];
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
        `SELECT id, name, mime_type AS mimeType, size, r2_key AS r2Key,
                page_count AS pageCount
         FROM documents WHERE id = ?`,
      )
      .bind(documentId)
      .first<{
        id: string;
        name: string;
        mimeType: string;
        size: number;
        r2Key: string;
        pageCount: number;
      }>();
    if (!document) {
      return Response.json({ error: "Không tìm thấy tài liệu." }, { status: 404 });
    }
    const sourcePages = await loadSourcePages(document);

    let result: OcrResult;
    let layoutMaps: LayoutMap[] = [];
    let mode = "gemini";
    let model: string | null = null;

    try {
      const pageResults: OcrResult[] = [];
      for (const sourcePage of sourcePages) {
        const layoutResponse = await callGeminiStructured({
          ...(model ? { model } : {}),
          mimeType: sourcePage.mimeType,
          data: sourcePage.base64,
          schema: layoutSchema,
          prompt: buildDocumentLayoutPrompt(
            sourcePage.pageNumber,
            sourcePage.width,
            sourcePage.height,
          ),
        });
        const normalizedLayout = {
          ...normalizeLayoutMap(
            layoutResponse.data as LayoutMap,
            sourcePage.width && sourcePage.height
              ? { width: sourcePage.width, height: sourcePage.height }
              : undefined,
          ),
          page: sourcePage.pageNumber,
        };
        layoutMaps.push(normalizedLayout);

        const response = await callGeminiStructured({
          model: layoutResponse.model,
          mimeType: sourcePage.mimeType,
          data: sourcePage.base64,
          schema: contentOcrSchema,
          prompt: `Bạn là hệ thống OCR đề thi Toán THCS tiếng Việt dành cho các lớp 6, 7, 8 và 9.
Đây là bước OCR nội dung chạy SAU bước Document Layout AI trên trang ${sourcePage.pageNumber}/${sourcePages.length}. Đọc theo đúng thứ tự và ranh giới vùng trong Layout Map dưới đây. Bảo toàn mọi công thức dưới dạng LaTeX.
Trong trường content, bọc từng biểu thức toán học bằng đúng một cặp dấu $...$.
Trường latex chỉ chứa công thức chính của câu hỏi, cũng bọc bằng đúng một cặp dấu $...$ để tương thích ToggleTeX của MathType. Không dùng $$...$$. Nếu câu hỏi không có công thức thì trả về chuỗi rỗng.
Không thay đổi bbox của Layout Map và không gộp các vùng khác loại.
Tách chính xác từng câu hỏi, xác định khối lớp từ 6 đến 9, phân loại theo mảng kiến thức Toán THCS và độ khó theo bốn mức BIET, HIEU, VAN_DUNG, VAN_DUNG_CAO.
Không tự sửa hoặc bổ sung dữ kiện không nhìn thấy. Tên tài liệu là "${document.name}".

Layout Map:
${JSON.stringify(normalizedLayout)}`,
        });
        pageResults.push(response.data as OcrResult);
        model = response.model;
      }

      const confidences = pageResults.map((page) =>
        normalizeConfidence(page.document?.confidence ?? 0),
      );
      result = {
        document: {
          name: document.name,
          pages: sourcePages.length,
          confidence:
            confidences.reduce((sum, value) => sum + value, 0) /
            Math.max(1, confidences.length),
        },
        questions: pageResults.flatMap((page) =>
          Array.isArray(page.questions) ? page.questions : [],
        ),
        imageRegions: layoutMaps.flatMap(reviewRegionsFromLayout),
      };
    } catch (error) {
      if (!(error instanceof NoGeminiKeyError)) throw error;
      result = {
        ...demoOcrResult,
        document: {
          ...demoOcrResult.document,
          name: document.name,
          pages: sourcePages.length,
        },
      };
      layoutMaps = [];
      mode = "demo";
    }

    const questions = (Array.isArray(result.questions) ? result.questions : []).map(
      (question, index) => ({
        ...question,
        id: `${documentId}-q-${index + 1}`,
        latex: normalizeToggleTex(question.latex),
        grade: Math.min(9, Math.max(6, Number(question.grade) || 9)),
        confidence: normalizeConfidence(question.confidence),
        assetCount: Math.max(0, Number(question.assetCount) || 0),
      }),
    );
    const questionIds = new Map(
      questions.map((question) => [question.code, question.id]),
    );
    const detectedRegions = layoutMaps.length
      ? layoutMaps.flatMap(reviewRegionsFromLayout)
      : Array.isArray(result.imageRegions)
        ? result.imageRegions
        : [];
    const imageRegions = detectedRegions.map((region, index) => ({
      ...region,
      id: `${documentId}-r-${index + 1}`,
      page: Math.max(1, Math.min(sourcePages.length, Number(region.page) || 1)),
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
                 box_json, page_number, confidence, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AWAITING_REVIEW')`,
            )
            .bind(
              region.id,
              documentId,
              region.questionId,
              region.questionCode,
              region.label,
              region.regionType,
              JSON.stringify(region.box),
              region.page,
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

    return Response.json({ result, layoutMaps, mode, model });
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

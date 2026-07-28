import { demoIllustrationSpec } from "@/lib/demo-data";
import { buildIllustrationPrompt } from "@/lib/illustration-prompt";
import { ensureDatabase } from "@/lib/server/database";
import {
  callGeminiStructured,
  NoGeminiKeyError,
} from "@/lib/server/gemini";

const illustrationSchema = {
  type: "OBJECT",
  properties: {
    illustrationType: {
      type: "STRING",
      enum: ["TECHNICAL_DIAGRAM", "CONTEXTUAL_DIAGRAM", "HYBRID"],
    },
    environment: { type: "STRING" },
    purpose: { type: "STRING", enum: ["QUESTION", "SOLUTION", "TEACHING"] },
    toScale: { type: "BOOLEAN" },
    facts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          value: { type: "STRING" },
          sourceVerified: { type: "BOOLEAN" },
        },
        required: ["label", "value", "sourceVerified"],
      },
    },
    caption: { type: "STRING" },
  },
  required: [
    "illustrationType",
    "environment",
    "purpose",
    "toScale",
    "facts",
    "caption",
  ],
};

function factsAreSafe(
  problem: string,
  spec: typeof demoIllustrationSpec,
  purpose: string,
) {
  const normalized = problem.replace(/\s+/g, " ").toLowerCase();
  return spec.facts.every((fact) => {
    if (["x", "?", "ẩn số"].includes(fact.value.toLowerCase())) return true;
    if (purpose !== "QUESTION") return true;
    return normalized.includes(fact.value.toLowerCase());
  });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      problem?: string;
      mode?: string;
      purpose?: string;
    };
    const problem = payload.problem?.trim() ?? "";
    const purpose = payload.purpose ?? "QUESTION";
    if (problem.length < 20) {
      return Response.json(
        { error: "Nội dung bài toán quá ngắn để tạo hình." },
        { status: 400 },
      );
    }

    let spec: typeof demoIllustrationSpec;
    let mode = "gemini";
    try {
      const result = await callGeminiStructured({
        schema: illustrationSchema,
        prompt: buildIllustrationPrompt({
          problem,
          purpose,
          mode: payload.mode ?? "HYBRID",
        }),
      });
      spec = result.data as typeof demoIllustrationSpec;
      if (!factsAreSafe(problem, spec, purpose)) {
        throw new Error("Hình đề xuất chứa dữ kiện không có trong đề bài.");
      }
    } catch (error) {
      if (!(error instanceof NoGeminiKeyError)) throw error;
      spec = demoIllustrationSpec;
      mode = "demo";
    }

    const id = crypto.randomUUID();
    const db = await ensureDatabase();
    await db
      .prepare(
        `INSERT INTO illustrations (id, prompt, mode, spec_json, status)
         VALUES (?, ?, ?, ?, 'AWAITING_REVIEW')`,
      )
      .bind(id, problem, payload.mode ?? "HYBRID", JSON.stringify(spec))
      .run();

    return Response.json({ illustration: { id, spec }, mode });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể tạo hình minh họa.",
      },
      { status: 500 },
    );
  }
}

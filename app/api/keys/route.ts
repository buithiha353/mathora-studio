import { encryptSecret } from "@/lib/server/crypto";
import { ensureDatabase } from "@/lib/server/database";
import { geminiErrorSummary } from "@/lib/server/gemini-error";
import { OCR_MODEL_ID } from "@/lib/gemini-models";

type KeyPayload = {
  label?: string;
  projectId?: string;
  apiKey?: string;
  priority?: number;
  model?: string;
};

export async function GET() {
  try {
    const db = await ensureDatabase();
    const rows = await db
      .prepare(
        `SELECT id, label, project_id AS projectId, hint, model, priority,
                usage_count AS usageCount, failure_count AS failureCount,
                status, cooldown_until AS cooldownUntil,
                last_used_at AS lastUsedAt, created_at AS createdAt
         FROM api_keys
         ORDER BY priority DESC, created_at ASC`,
      )
      .all();
    return Response.json({ keys: rows.results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tải API key." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as KeyPayload;
    const label = payload.label?.trim() ?? "";
    const projectId = payload.projectId?.trim() ?? "";
    const apiKey = payload.apiKey?.trim() ?? "";
    const model = OCR_MODEL_ID;
    const priority = Math.max(1, Math.min(10, Number(payload.priority ?? 1)));

    if (!label || !projectId || apiKey.length < 20) {
      return Response.json(
        { error: "Tên key, project và API key hợp lệ là bắt buộc." },
        { status: 400 },
      );
    }

    const test = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${OCR_MODEL_ID}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: "Reply with exactly: OK" }],
            },
          ],
        }),
      },
    );
    const canSaveAfterTemporaryFailure = [429, 500, 503, 504].includes(
      test.status,
    );
    let warning: string | undefined;
    if (!test.ok && !canSaveAfterTemporaryFailure) {
      const detail = await geminiErrorSummary(test);
      return Response.json(
        {
          error: `Không thể dùng ${OCR_MODEL_ID}. Google trả về ${test.status}: ${detail}`,
        },
        { status: 400 },
      );
    }
    if (!test.ok) {
      const detail = await geminiErrorSummary(test);
      warning = `Key đã được lưu, nhưng Google đang tạm giới hạn dịch vụ (${test.status}: ${detail}).`;
    }

    const encrypted = await encryptSecret(apiKey);
    const id = crypto.randomUUID();
    const hint = `${apiKey.slice(0, 5)}••••${apiKey.slice(-4)}`;
    const db = await ensureDatabase();
    await db
      .prepare(
        `INSERT INTO api_keys
          (id, label, project_id, cipher_text, iv, hint, model, priority, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      )
      .bind(
        id,
        label,
        projectId,
        encrypted.cipherText,
        encrypted.iv,
        hint,
        model,
        priority,
      )
      .run();

    return Response.json(
      {
        key: {
          id,
          label,
          projectId,
          hint,
          model,
          priority,
          usageCount: 0,
          status: "ACTIVE",
        },
        warning,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể lưu API key." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id) return Response.json({ error: "Thiếu ID." }, { status: 400 });
    const db = await ensureDatabase();
    await db.prepare("DELETE FROM api_keys WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể xóa API key." },
      { status: 500 },
    );
  }
}

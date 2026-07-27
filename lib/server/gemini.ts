import { decryptSecret } from "./crypto";
import { ensureDatabase } from "./database";

type ApiKeyRow = {
  id: string;
  project_id: string;
  cipher_text: string;
  iv: string;
  model: string;
};

type GeminiCall = {
  prompt: string;
  mimeType?: string;
  data?: string;
  schema?: Record<string, unknown>;
};

export class NoGeminiKeyError extends Error {
  constructor() {
    super("Chưa có Gemini API key đang hoạt động.");
  }
}

function responseText(payload: unknown) {
  const data = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  return data.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
}

async function healthyKeys() {
  const db = await ensureDatabase();
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `SELECT id, project_id, cipher_text, iv, model
       FROM api_keys
       WHERE status = 'ACTIVE'
         AND (cooldown_until IS NULL OR cooldown_until <= ?)
       ORDER BY priority DESC, usage_count ASC, created_at ASC
       LIMIT 8`,
    )
    .bind(now)
    .all<ApiKeyRow>();
  return result.results;
}

async function markSuccess(keyId: string) {
  const db = await ensureDatabase();
  await db
    .prepare(
      `UPDATE api_keys
       SET usage_count = usage_count + 1,
           last_used_at = CURRENT_TIMESTAMP,
           failure_count = 0
       WHERE id = ?`,
    )
    .bind(keyId)
    .run();
}

async function markFailure(key: ApiKeyRow, status: number) {
  const db = await ensureDatabase();
  if (status === 401 || status === 403) {
    await db
      .prepare(
        "UPDATE api_keys SET status = 'INVALID', failure_count = failure_count + 1 WHERE id = ?",
      )
      .bind(key.id)
      .run();
    return;
  }

  if (status === 429) {
    const cooldownUntil = new Date(Date.now() + 60_000).toISOString();
    await db
      .prepare(
        `UPDATE api_keys
         SET cooldown_until = ?, failure_count = failure_count + 1
         WHERE project_id = ?`,
      )
      .bind(cooldownUntil, key.project_id)
      .run();
    return;
  }

  await db
    .prepare(
      "UPDATE api_keys SET failure_count = failure_count + 1 WHERE id = ?",
    )
    .bind(key.id)
    .run();
}

export async function callGeminiStructured(input: GeminiCall) {
  const keys = await healthyKeys();
  if (!keys.length) throw new NoGeminiKeyError();

  let lastError = "Gemini không phản hồi.";
  const triedProjects = new Set<string>();

  for (const key of keys) {
    if (triedProjects.has(key.project_id)) continue;
    triedProjects.add(key.project_id);

    const plainKey = await decryptSecret(key.cipher_text, key.iv);
    const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
    if (input.mimeType && input.data) {
      parts.unshift({
        inlineData: { mimeType: input.mimeType, data: input.data },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(key.model)}:generateContent?key=${encodeURIComponent(plainKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            ...(input.schema ? { responseSchema: input.schema } : {}),
          },
        }),
      },
    );

    if (response.ok) {
      const payload = await response.json();
      const text = responseText(payload);
      if (!text) throw new Error("Gemini trả về nội dung rỗng.");
      await markSuccess(key.id);
      return {
        data: JSON.parse(text) as Record<string, unknown>,
        keyId: key.id,
        model: key.model,
      };
    }

    lastError = `${response.status}: ${(await response.text()).slice(0, 240)}`;
    await markFailure(key, response.status);
    if (![429, 500, 503, 504].includes(response.status)) break;
  }

  throw new Error(lastError);
}

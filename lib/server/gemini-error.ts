type GeminiErrorPayload = {
  error?: {
    message?: string;
    status?: string;
  };
};

function sanitize(value: string) {
  return value
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[API key]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}

export async function geminiErrorSummary(response: Response) {
  const raw = await response.text();
  let status = "";
  let message = "";

  try {
    const payload = JSON.parse(raw) as GeminiErrorPayload;
    status = sanitize(payload.error?.status ?? "");
    message = sanitize(payload.error?.message ?? "");
  } catch {
    message = sanitize(raw);
  }

  if (status && message) return `${status}: ${message}`;
  return message || status || `HTTP ${response.status}`;
}

export function normalizeToggleTex(input: unknown) {
  let value = String(input ?? "").trim();
  if (!value) return "";

  value = value
    .replace(/^```(?:latex|tex)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const wrappers: Array<[string, string]> = [
    ["$$", "$$"],
    ["\\[", "\\]"],
    ["\\(", "\\)"],
    ["$", "$"],
  ];
  for (const [open, close] of wrappers) {
    if (
      value.startsWith(open) &&
      value.endsWith(close) &&
      value.length > open.length + close.length
    ) {
      value = value.slice(open.length, -close.length).trim();
      break;
    }
  }

  return value ? `$${value}$` : "";
}

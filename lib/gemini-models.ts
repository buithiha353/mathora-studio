export const OCR_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
] as const;

export type OcrModelId = (typeof OCR_MODELS)[number]["id"];

export const OCR_MODEL_ID: OcrModelId = "gemini-3.5-flash-lite";
export const OCR_MODEL_LABEL = "Gemini 3.5 Flash-Lite";

export function isOcrModel(value: string): value is OcrModelId {
  return OCR_MODELS.some((model) => model.id === value);
}

export function ocrModelLabel(value: string) {
  return OCR_MODELS.find((model) => model.id === value)?.label ?? value;
}

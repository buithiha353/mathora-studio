import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("defines the complete Mathora Studio workspace", async () => {
  const [page, studio, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /MathOcrStudio/);
  assert.match(layout, /Mathora Studio/);
  assert.match(studio, /Bàn xử lý/);
  assert.match(studio, /Làm nét ảnh độc lập/);
  assert.doesNotMatch(studio, /Làm nét trước OCR/);
  assert.match(studio, /Lớp 9/);
  assert.match(studio, /Thư viện câu hỏi/);
  assert.match(studio, /Tạo đề theo ma trận/);
  assert.match(studio, /Hình dung bài toán thực tế/);
  assert.match(studio, /Đưa vào thư viện/);
  assert.match(studio, /LaTeX công thức/);
  assert.match(studio, /Xoay vòng theo sức khỏe/);
  assert.doesNotMatch(studio, /codex-preview|Your site is taking shape/i);
});

test("requires human review before questions can enter exams", async () => {
  const [reviewRoute, processRoute, examRoute] = await Promise.all([
    readFile(new URL("../app/api/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/process/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/exams/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(processRoute, /INSERT INTO image_regions/);
  assert.match(processRoute, /AWAITING_REVIEW/);
  assert.match(reviewRoute, /confirmedQuestionIds/);
  assert.match(reviewRoute, /confirmedRegionIds/);
  assert.match(reviewRoute, /status = 'REVIEWED'/);
  assert.match(reviewRoute, /status = 'COMPLETED'/);
  assert.match(examRoute, /status = 'REVIEWED'/);
  assert.doesNotMatch(examRoute, /AWAITING_REVIEW/);
});

test("pins OCR recognition to the stable Gemini 3.5 Flash model", async () => {
  const [models, gemini, processRoute, keysRoute, studio] = await Promise.all([
    readFile(new URL("../lib/gemini-models.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/gemini.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/process/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/keys/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(models, /gemini-3\.5-flash/);
  assert.match(processRoute, /model: OCR_MODEL_ID/);
  assert.match(keysRoute, /models\/\$\{OCR_MODEL_ID\}:generateContent/);
  assert.match(keysRoute, /x-goog-api-key/);
  assert.match(keysRoute, /geminiErrorSummary/);
  assert.match(gemini, /x-goog-api-key/);
  assert.match(gemini, /geminiErrorSummary/);
  assert.doesNotMatch(keysRoute, /\?key=/);
  assert.doesNotMatch(gemini, /\?key=/);
  assert.match(studio, /Nhận diện AI/);
  assert.doesNotMatch(gemini, /temperature|top_p|top_k/);
});

test("removes starter preview and declares persistent bindings", async () => {
  const [hosting, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
  assert.match(page, /MathOcrStudio/);
  assert.match(layout, /lang="vi"/);
  assert.match(packageJson, /"name": "mathora-studio"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

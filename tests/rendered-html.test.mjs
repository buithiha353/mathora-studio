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

test("supports selectable Gemini models for document recognition", async () => {
  const [models, gemini, processRoute, keysRoute, studio] = await Promise.all([
    readFile(new URL("../lib/gemini-models.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/gemini.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/process/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/keys/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(models, /gemini-2\.5-flash/);
  assert.match(models, /gemini-3\.5-flash-lite/);
  assert.match(models, /gemini-3\.1-flash-lite/);
  assert.match(processRoute, /model: layoutResponse\.model/);
  assert.match(keysRoute, /encodeURIComponent\(model\)/);
  assert.match(keysRoute, /isOcrModel/);
  assert.match(keysRoute, /x-goog-api-key/);
  assert.match(keysRoute, /geminiErrorSummary/);
  assert.match(gemini, /x-goog-api-key/);
  assert.match(gemini, /geminiErrorSummary/);
  assert.doesNotMatch(keysRoute, /\?key=/);
  assert.doesNotMatch(gemini, /\?key=/);
  assert.match(studio, /Nhận diện AI/);
  assert.match(studio, /OCR_MODELS\.map/);
  assert.doesNotMatch(studio, /Google Cloud project/);
  assert.doesNotMatch(keysRoute, /projectId\?/);
  assert.doesNotMatch(gemini, /temperature|top_p|top_k/);
});

test("runs layout mapping before content OCR", async () => {
  const [layoutPrompt, processRoute] = await Promise.all([
    readFile(new URL("../lib/layout-prompt.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/process/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layoutPrompt, /Document Layout AI/);
  assert.match(layoutPrompt, /KHÔNG OCR nội dung/);
  assert.match(layoutPrompt, /QUESTION_NUMBER/);
  assert.match(layoutPrompt, /Tọa độ theo PIXEL/);
  assert.match(layoutPrompt, /need_review=true/);
  assert.match(layoutPrompt, /Chỉ trả về JSON hợp lệ/);
  assert.match(processRoute, /schema: layoutSchema/);
  assert.match(processRoute, /buildDocumentLayoutPrompt/);
  assert.match(processRoute, /normalizeLayoutMap/);
  assert.match(processRoute, /reviewRegionsFromLayout/);
  assert.match(processRoute, /Đây là bước OCR nội dung chạy SAU/);
});

test("splits PDF files into PNG pages before Gemini processing", async () => {
  const [studio, pageRoute, processRoute, packageJson] = await Promise.all([
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/upload/page/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/process/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /pdfjs-dist/);
  assert.match(studio, /renderPdfPages/);
  assert.match(studio, /page\.render/);
  assert.match(studio, /api\/upload\/page/);
  assert.match(pageRoute, /image\/png/);
  assert.match(pageRoute, /page-\$\{String\(pageNumber\)\.padStart\(4, "0"\)\}\.png/);
  assert.match(processRoute, /loadSourcePages/);
  assert.match(processRoute, /for \(const sourcePage of sourcePages\)/);
  assert.match(processRoute, /mimeType: "image\/png"/);
  assert.match(processRoute, /buildDocumentLayoutPrompt\(sourcePage\.pageNumber\)/);
});

test("supports moving and resizing detected image regions", async () => {
  const [studio, reviewRoute, styles] = await Promise.all([
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /beginGesture/);
  assert.match(studio, /moveGesture/);
  assert.match(studio, /onRegionBoxChange/);
  assert.match(studio, /region-resize-handle/);
  assert.match(studio, /Kéo trong khung để di chuyển/);
  assert.match(studio, /region-coordinate-grid/);
  assert.match(reviewRoute, /page_number = \?/);
  assert.match(styles, /touch-action: none/);
  assert.match(styles, /\.handle-se/);
});

test("applies the THCS textbook illustration prompt", async () => {
  const [illustrationPrompt, illustrationRoute] = await Promise.all([
    readFile(new URL("../lib/illustration-prompt.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/illustrations/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(illustrationPrompt, /sách giáo khoa Toán THCS/);
  assert.match(illustrationPrompt, /Không hiệu ứng 3D/);
  assert.match(illustrationPrompt, /Góc vuông phải có ký hiệu/);
  assert.match(illustrationPrompt, /Chỉ sử dụng 2–4 màu nhạt/);
  assert.match(illustrationPrompt, /gợn sóng/);
  assert.match(illustrationPrompt, /chiếc thuyền nâu nhỏ/);
  assert.match(illustrationPrompt, /tam giác vuông ABC/);
  assert.match(illustrationPrompt, /AC là đường chuyển động của thuyền/);
  assert.match(illustrationPrompt, /Không đặt dấu \? trên AB/);
  assert.match(illustrationPrompt, /không\s+sao chép máy móc/);
  assert.match(illustrationPrompt, /không để lộ đáp án/);
  assert.match(illustrationPrompt, /caption chỉ dùng làm metadata nội bộ/);
  assert.match(illustrationRoute, /buildIllustrationPrompt/);
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

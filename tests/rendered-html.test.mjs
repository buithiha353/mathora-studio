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
  assert.match(studio, /LaTeX ToggleTeX/);
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

test("keeps the library free of initial sample questions", async () => {
  const [database, studio, overviewRoute] = await Promise.all([
    readFile(new URL("../lib/server/database.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/overview/route.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(database, /INSERT OR REPLACE INTO questions/);
  assert.match(database, /DELETE FROM questions/);
  assert.match(database, /'q-demo-01'/);
  assert.match(database, /'q-demo-06'/);
  assert.match(database, /question_ids_json LIKE '%q-demo-%'/);
  assert.match(studio, /questions: \[\] as Question\[\]/);
  assert.match(overviewRoute, /"Cache-Control": "no-store"/);
});

test("clears the complete legacy library once without deleting future questions", async () => {
  const database = await readFile(
    new URL("../lib/server/database.ts", import.meta.url),
    "utf8",
  );

  assert.match(database, /CREATE TABLE IF NOT EXISTS app_migrations/);
  assert.match(database, /2026-07-29-clear-library-v16/);
  assert.match(database, /DELETE FROM exams/);
  assert.match(database, /DELETE FROM image_regions/);
  assert.match(database, /UPDATE illustrations SET question_id = NULL/);
  assert.match(database, /DELETE FROM questions/);
  assert.match(database, /if \(!libraryAlreadyCleared\)/);
});

test("preserves workspaces across navigation and lets sharpening reuse OCR images", async () => {
  const [studio, styles] = await Promise.all([
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /hidden=\{view !== "review"\}/);
  assert.match(studio, /hidden=\{view !== "enhance"\}/);
  assert.match(studio, /ocrImageOptions/);
  assert.match(studio, /Lấy ảnh từ OCR/);
  assert.match(studio, /chooseOcrImage/);
  assert.match(styles, /\.workspace-view\[hidden\]/);
  assert.match(styles, /\.ocr-image-picker/);
});

test("normalizes OCR formulas for MathType ToggleTeX", async () => {
  const [latex, processRoute, reviewRoute, studio] = await Promise.all([
    readFile(new URL("../lib/latex.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/process/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/review/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(latex, /normalizeToggleTex/);
  assert.match(latex, /return value \? `\$\$\{value\}\$` : ""/);
  assert.match(processRoute, /normalizeToggleTex\(question\.latex\)/);
  assert.match(processRoute, /ToggleTeX của MathType/);
  assert.match(reviewRoute, /normalizeToggleTex\(question\.latex\)/);
  assert.match(studio, /LaTeX ToggleTeX · dùng cặp dấu \$\.\.\.\$/);
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
  assert.match(processRoute, /sourcePage\.width/);
  assert.match(processRoute, /sourcePage\.height/);
  assert.match(pageRoute, /JSON\.stringify\(\{ width, height \}\)/);
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

test("shows real OCR crops and keeps overlays aligned to source images", async () => {
  const [studio, styles, layoutPrompt, processRoute] = await Promise.all([
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/layout-prompt.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/process/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /RegionCropPreview/);
  assert.match(studio, /region-crop-source/);
  assert.doesNotMatch(studio, /mini-circle/);
  assert.match(styles, /\.paper\.has-image-source/);
  assert.match(styles, /height: auto/);
  assert.match(layoutPrompt, /Kích thước CHÍNH XÁC/);
  assert.match(layoutPrompt, /Khoanh bbox sát biên nội dung/);
  assert.match(processRoute, /expectedSize/);
});

test("supports question details, grade filtering, and exam regeneration", async () => {
  const [studio, examRoute] = await Promise.all([
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/exams/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /Chi tiết câu hỏi/);
  assert.match(studio, /Lọc câu hỏi theo lớp/);
  assert.match(studio, /Tất cả lớp/);
  assert.doesNotMatch(studio, />\s*Bộ lọc\s*</);
  assert.match(studio, /"Tạo lại"/);
  assert.match(examRoute, /ORDER BY RANDOM\(\)/);
});

test("attaches confirmed source images to library questions and exams", async () => {
  const [overviewRoute, examRoute, regionImageRoute, studio] = await Promise.all([
    readFile(new URL("../app/api/overview/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/exams/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/region-image/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(overviewRoute, /FROM image_regions/);
  assert.match(overviewRoute, /status = 'CONFIRMED'/);
  assert.match(overviewRoute, /sourceUrl/);
  assert.match(examRoute, /finalQuestionsWithAssets/);
  assert.match(regionImageRoute, /JOIN documents/);
  assert.match(regionImageRoute, /requireFiles\(\)\.get/);
  assert.match(studio, /Hình đi kèm/);
  assert.match(studio, /selectedQuestion\.assets/);
});

test("exports generated exams to Word with formulas and cropped images", async () => {
  const [studio, wordBuilder, packageJson] = await Promise.all([
    readFile(new URL("../app/MathOcrStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/exam-docx.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"docx"/);
  assert.match(studio, /cropQuestionAsset/);
  assert.match(studio, /packExamDocument/);
  assert.match(studio, /Tải Word \(\.docx\)/);
  assert.match(studio, /link\.download = `\$\{safeName\}\.docx`/);
  assert.match(wordBuilder, /new ImageRun/);
  assert.match(wordBuilder, /Cambria Math/);
  assert.match(wordBuilder, /Packer\.toBlob/);
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

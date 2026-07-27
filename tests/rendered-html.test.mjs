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
  assert.match(studio, /Xoay vòng theo sức khỏe/);
  assert.doesNotMatch(studio, /codex-preview|Your site is taking shape/i);
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

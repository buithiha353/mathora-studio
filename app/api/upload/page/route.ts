import { requireFiles } from "@/lib/server/bindings";
import { ensureDatabase } from "@/lib/server/database";

const MAX_PAGE_SIZE = 18 * 1024 * 1024;
const MAX_PAGE_COUNT = 200;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const documentId = String(form.get("documentId") ?? "").trim();
    const page = form.get("page");
    const pageNumber = Number(form.get("pageNumber"));
    const totalPages = Number(form.get("totalPages"));
    const width = Number(form.get("width"));
    const height = Number(form.get("height"));

    if (
      !documentId ||
      !(page instanceof File) ||
      page.type !== "image/png" ||
      !Number.isInteger(pageNumber) ||
      !Number.isInteger(totalPages) ||
      pageNumber < 1 ||
      totalPages < 1 ||
      pageNumber > totalPages ||
      totalPages > MAX_PAGE_COUNT ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1
    ) {
      return Response.json(
        { error: "Thông tin ảnh trang PDF không hợp lệ." },
        { status: 400 },
      );
    }
    if (page.size > MAX_PAGE_SIZE) {
      return Response.json(
        { error: `Ảnh trang ${pageNumber} vượt quá giới hạn 18 MB.` },
        { status: 413 },
      );
    }

    const db = await ensureDatabase();
    const document = await db
      .prepare("SELECT id, mime_type AS mimeType FROM documents WHERE id = ?")
      .bind(documentId)
      .first<{ id: string; mimeType: string }>();
    if (!document || document.mimeType !== "application/pdf") {
      return Response.json(
        { error: "Không tìm thấy tài liệu PDF tương ứng." },
        { status: 404 },
      );
    }

    const pageKey = `documents/${documentId}/pages/page-${String(pageNumber).padStart(4, "0")}.png`;
    await requireFiles().put(pageKey, await page.arrayBuffer(), {
      httpMetadata: { contentType: "image/png" },
      customMetadata: {
        documentId,
        pageNumber: String(pageNumber),
        totalPages: String(totalPages),
      },
    });
    await requireFiles().put(
      `${pageKey}.json`,
      await new Blob([
        JSON.stringify({ width, height }),
      ]).arrayBuffer(),
      { httpMetadata: { contentType: "application/json" } },
    );
    await db
      .prepare("UPDATE documents SET page_count = ? WHERE id = ?")
      .bind(totalPages, documentId)
      .run();

    return Response.json(
      {
        page: {
          documentId,
          pageNumber,
          totalPages,
          mimeType: "image/png",
          width,
          height,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể lưu ảnh trang PDF.",
      },
      { status: 500 },
    );
  }
}

import { requireFiles } from "@/lib/server/bindings";
import { ensureDatabase } from "@/lib/server/database";

export async function GET(request: Request) {
  try {
    const regionId = new URL(request.url).searchParams.get("regionId")?.trim();
    if (!regionId) {
      return Response.json({ error: "Thiếu mã vùng ảnh." }, { status: 400 });
    }

    const db = await ensureDatabase();
    const region = await db
      .prepare(
        `SELECT r.id, r.page_number AS page, d.id AS documentId,
                d.mime_type AS mimeType, d.r2_key AS r2Key
         FROM image_regions r
         JOIN documents d ON d.id = r.document_id
         WHERE r.id = ? AND r.status = 'CONFIRMED'`,
      )
      .bind(regionId)
      .first<{
        id: string;
        page: number;
        documentId: string;
        mimeType: string;
        r2Key: string;
      }>();
    if (!region) {
      return Response.json({ error: "Không tìm thấy vùng ảnh đã duyệt." }, { status: 404 });
    }

    const isPdf = region.mimeType === "application/pdf";
    const key = isPdf
      ? `documents/${region.documentId}/pages/page-${String(
          Math.max(1, Number(region.page) || 1),
        ).padStart(4, "0")}.png`
      : region.r2Key;
    const object = await requireFiles().get(key);
    if (!object) {
      return Response.json({ error: "Không tìm thấy ảnh nguồn." }, { status: 404 });
    }

    return new Response(await object.arrayBuffer(), {
      headers: {
        "content-type": isPdf ? "image/png" : region.mimeType,
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể tải ảnh của câu hỏi.",
      },
      { status: 500 },
    );
  }
}

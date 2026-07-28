import { ensureDatabase } from "@/lib/server/database";
import { requireFiles } from "@/lib/server/bindings";

const acceptedTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const sharpenProfile = String(form.get("sharpenProfile") ?? "NONE");
    const sourceWidth = Number(form.get("sourceWidth"));
    const sourceHeight = Number(form.get("sourceHeight"));

    if (!(file instanceof File)) {
      return Response.json({ error: "Vui lòng chọn một tệp." }, { status: 400 });
    }
    if (!acceptedTypes.has(file.type)) {
      return Response.json(
        { error: "Chỉ hỗ trợ PDF, PNG, JPEG và WEBP." },
        { status: 415 },
      );
    }
    if (file.size > 50 * 1024 * 1024) {
      return Response.json(
        { error: "Kích thước tệp tối đa là 50 MB." },
        { status: 413 },
      );
    }

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const r2Key = `documents/${id}/${safeName}`;
    const files = requireFiles();
    await files.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { originalName: file.name },
    });
    if (
      file.type.startsWith("image/") &&
      Number.isInteger(sourceWidth) &&
      Number.isInteger(sourceHeight) &&
      sourceWidth > 0 &&
      sourceHeight > 0
    ) {
      await files.put(
        `documents/${id}/source-dimensions.json`,
        await new Blob([
          JSON.stringify({ width: sourceWidth, height: sourceHeight }),
        ]).arrayBuffer(),
        { httpMetadata: { contentType: "application/json" } },
      );
    }

    const db = await ensureDatabase();
    await db
      .prepare(
        `INSERT INTO documents
          (id, name, mime_type, size, r2_key, status, sharpen_profile)
         VALUES (?, ?, ?, ?, ?, 'UPLOADED', ?)`,
      )
      .bind(id, file.name, file.type, file.size, r2Key, sharpenProfile)
      .run();

    return Response.json(
      {
        document: {
          id,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          status: "UPLOADED",
          sharpenProfile,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tải tệp." },
      { status: 500 },
    );
  }
}

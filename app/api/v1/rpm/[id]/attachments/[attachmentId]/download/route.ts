import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { getRpmAttachmentForDownload } from "@/lib/services/rpmAttachmentService";
import { AppError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  return withAuth(req, async () => {
    try {
      const { id, attachmentId } = await params;
      const user = (req as any).user;
      const { searchParams } = new URL(req.url);
      const isDownload = searchParams.get("download") === "1" || searchParams.get("download") === "true";

      const { attachment, fileBuffer } = await getRpmAttachmentForDownload(
        id,
        attachmentId,
        user
      );

      const dispositionType = isDownload ? "attachment" : "inline";
      // Encode RFC 5987 filename
      const encodedFilename = encodeURIComponent(attachment.originalFilename);
      const asciiFilename = attachment.originalFilename.replace(/[^\x20-\x7e]/g, "_");

      const headers = new Headers();
      headers.set("Content-Type", attachment.mimeType || "application/octet-stream");
      headers.set(
        "Content-Disposition",
        `${dispositionType}; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
      );
      headers.set("Content-Length", String(fileBuffer.length));
      headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("Expires", "0");
      headers.set("X-Content-Type-Options", "nosniff");

      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return new NextResponse(error.message, { status: error.statusCode });
      }
      return new NextResponse("Gagal mengakses file lampiran.", { status: 500 });
    }
  });
}

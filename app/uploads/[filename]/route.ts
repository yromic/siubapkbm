import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const resolvedParams = await params;
  const filename = resolvedParams.filename;

  if (!filename) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Prevent directory traversal attacks
  const safeFilename = path.basename(filename);

  // Check location for the uploaded file
  for (const filePath of [
    path.join(process.env.UPLOADS_DIR || path.join(process.cwd(), 'storage', 'uploads'), safeFilename),
  ]) {
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(safeFilename).toLowerCase();

      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  return new NextResponse('File Not Found', { status: 404 });
}

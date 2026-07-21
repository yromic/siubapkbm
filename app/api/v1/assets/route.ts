import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/withAuth';
import { withRole } from '@/lib/middleware/withRole';
import {
  createAsset,
  listAssets,
  updateAsset,
  deleteAsset,
  Asset
} from '@/lib/services/assetService';
import { successResponse, errorResponse } from '@/lib/response';
import { AppError } from '@/lib/errors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

function ensureUploadsDirectory() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

// GET /api/v1/assets - List all assets (Public/Admin depending on use-case, but let's secure it for authenticated users)
export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const assets = await listAssets();
      return successResponse(assets, 'Assets retrieved successfully.');
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error.message, error.code, error.statusCode);
      }
      return errorResponse(
        error instanceof Error ? error.message : 'Database error listing assets.',
        'ERR_INTERNAL_SERVER',
        500
      );
    }
  });
}

// POST /api/v1/assets - Upload asset (Base64)
export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const body = await req.json();
        const { filename, base64, alt, title, caption } = body;

        if (!filename || !base64) {
          return errorResponse('Filename and base64 content are required.', 'ERR_VALIDATION', 400);
        }

        ensureUploadsDirectory();

        const ext = path.extname(filename);
        const uniqueId = uuidv4();
        const cleanFilename = `${path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_')}_${uniqueId}${ext}`;
        const filePath = path.join(UPLOADS_DIR, cleanFilename);

        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(filePath, buffer);

        const url = `/uploads/${cleanFilename}`;
        const mimeType = getMimeType(filename);
        const sizeBytes = buffer.length;

        const asset = await createAsset({
          url,
          alt: alt || path.basename(filename, ext),
          title: title || null,
          caption: caption || null,
          mime_type: mimeType,
          size_bytes: sizeBytes
        });

        return successResponse(asset, 'Asset uploaded and registered successfully.', 201);
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Error processing asset upload.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

// PATCH /api/v1/assets - Update metadata
export async function PATCH(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const body = await req.json();
        const { id, alt, title, caption } = body;

        if (!id) {
          return errorResponse('Asset ID is required.', 'ERR_VALIDATION', 400);
        }

        const updated = await updateAsset(id, {
          alt,
          title,
          caption
        });

        return successResponse(updated, 'Asset metadata updated successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Error updating asset metadata.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

// DELETE /api/v1/assets - Delete asset
export async function DELETE(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(['administrator', 'admin'], req, async () => {
      try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
          return errorResponse('Asset ID is required.', 'ERR_VALIDATION', 400);
        }

        // 1. Find the target asset to get its URL for file deletion
        const assets = await listAssets();
        const target = assets.find(a => a.id === id);
        
        if (!target) {
          return errorResponse('Asset not found.', 'ERR_NOT_FOUND', 404);
        }

        // 2. Delete database entry first (checks referential integrity constraints)
        await deleteAsset(id);

        // 3. If DB deletion succeeds without error, safely remove physical file from disk
        const filename = path.basename(target.url);
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        return successResponse(null, 'Asset deleted successfully.');
      } catch (error) {
        if (error instanceof AppError) {
          return errorResponse(error.message, error.code, error.statusCode);
        }
        return errorResponse(
          error instanceof Error ? error.message : 'Error deleting asset.',
          'ERR_INTERNAL_SERVER',
          500
        );
      }
    });
  });
}

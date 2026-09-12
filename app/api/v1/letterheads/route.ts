import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { withRole } from "@/lib/middleware/withRole";
import {
  listLetterheadVersions,
  registerLetterheadVersion,
  getAppSettings,
} from "@/lib/services/appSettingsService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError } from "@/lib/errors";
import {
  validateLetterheadMagicBytes,
  validateLetterheadSize,
  buildLetterheadFilename,
  MAX_LETTERHEAD_SIZE_BYTES,
} from "@/lib/utils/letterheadUploadUtils";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "storage", "uploads");

function ensureUploadsDirectory() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * GET /api/v1/letterheads
 * List all letterhead versions (accessible to admin and teachers for reference).
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(
      ["administrator", "admin", "teacher"],
      req,
      async () => {
        try {
          const versions = await listLetterheadVersions();
          const settings = await getAppSettings();
          return successResponse(
            {
              versions,
              active_letterhead_id: settings.active_letterhead_id || null,
              active_letterhead_url: settings.active_letterhead_url || null,
            },
            "Daftar versi kop surat berhasil dimuat."
          );
        } catch (error) {
          if (error instanceof AppError) {
            return errorResponse(error.message, error.code, error.statusCode);
          }
          return errorResponse(
            "Gagal memuat daftar kop surat.",
            "ERR_INTERNAL_SERVER",
            500
          );
        }
      }
    );
  });
}

/**
 * POST /api/v1/letterheads
 * Upload a new letterhead version (Admin only).
 *
 * Request: multipart/form-data
 *   - name: string (display name, e.g. "Kop Resmi 2025-2026")
 *   - file: binary (PNG or JPEG, max 2MB)
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (req) => {
    return withRole(
      ["administrator", "admin"],
      req,
      async () => {
        try {
          const user = (req as any).user as { id: string; role: string };

          const contentType = req.headers.get("content-type") || "";
          if (!contentType.includes("multipart/form-data")) {
            return errorResponse(
              "Request harus menggunakan multipart/form-data.",
              "ERR_VALIDATION",
              400
            );
          }

          const formData = await req.formData();
          const name = formData.get("name");
          const file = formData.get("file");

          if (!name || typeof name !== "string" || !name.trim()) {
            return errorResponse(
              "Nama versi kop surat wajib diisi.",
              "ERR_VALIDATION",
              400
            );
          }

          if (!file || !(file instanceof Blob)) {
            return errorResponse(
              "File gambar kop surat wajib diunggah.",
              "ERR_VALIDATION",
              400
            );
          }

          // Size validation
          if (!validateLetterheadSize(file.size)) {
            return errorResponse(
              `Ukuran file melebihi batas maksimum ${Math.round(MAX_LETTERHEAD_SIZE_BYTES / 1024 / 1024)} MB.`,
              "ERR_VALIDATION",
              400
            );
          }

          // Read bytes for magic byte validation
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const magic = validateLetterheadMagicBytes(buffer);
          if (!magic.valid) {
            return errorResponse(
              "Format file tidak didukung. Unggah file PNG atau JPG yang valid.",
              "ERR_VALIDATION",
              400
            );
          }

          // Write to disk with UUID-based immutable filename
          ensureUploadsDirectory();
          const versionId = uuidv4();
          const filename = buildLetterheadFilename(versionId, magic.ext!);
          const filePath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(filePath, buffer);

          const url = `/uploads/${filename}`;

          // Register in app_settings (status: PENDING — not yet active)
          const version = await registerLetterheadVersion(
            {
              id: versionId,
              name: name.trim(),
              url,
              ext: magic.ext!,
              size_bytes: buffer.length,
            },
            user.id
          );

          return successResponse(
            version,
            "Kop surat berhasil diunggah. Aktifkan versi ini untuk digunakan secara global.",
            201
          );
        } catch (error) {
          if (error instanceof AppError) {
            return errorResponse(error.message, error.code, error.statusCode);
          }
          return errorResponse(
            "Gagal mengunggah kop surat.",
            "ERR_INTERNAL_SERVER",
            500
          );
        }
      }
    );
  });
}

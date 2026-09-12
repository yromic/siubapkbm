import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/withAuth";
import { successResponse } from "@/lib/response";
import { resolveBuildInfo } from "@/lib/utils/buildInfo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const build = resolveBuildInfo({
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
      GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA,
      NEXT_PUBLIC_GIT_SHA: process.env.NEXT_PUBLIC_GIT_SHA,
    });

    return successResponse({
      app_name: "SIUBA",
      version: "1.0.0",
      description: "Sistem Informasi Ujian Berbasis Akademik",
      environment: process.env.NODE_ENV || "development",
      api_version: "v1",
      build_date: "2026-07-09",
      build,
    }, "Version info retrieved.");
  });
}

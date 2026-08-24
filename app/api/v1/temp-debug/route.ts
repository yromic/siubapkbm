import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * @deprecated
 * Temporary debug endpoint disabled for production security.
 */
export async function GET() {
  return NextResponse.json(
    { status: "error", code: "ERR_NOT_FOUND", message: "Endpoint disabled in production." },
    { status: 404 }
  );
}

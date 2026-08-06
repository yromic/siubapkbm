import { NextResponse } from "next/server";

/**
 * @deprecated
 * Test culture contract endpoint disabled for production security (Sprint 8).
 */
export async function GET() {
  return NextResponse.json(
    { status: "error", code: "ERR_NOT_FOUND", message: "Endpoint disabled in production." },
    { status: 404 }
  );
}

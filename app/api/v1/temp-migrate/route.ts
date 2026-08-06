import { NextResponse } from "next/server";

/**
 * @deprecated
 * Temporary migration endpoint disabled for production security (Sprint 8).
 */
export async function GET() {
  return NextResponse.json(
    { status: "error", code: "ERR_NOT_FOUND", message: "Endpoint disabled in production." },
    { status: 404 }
  );
}

export async function POST() {
  return NextResponse.json(
    { status: "error", code: "ERR_NOT_FOUND", message: "Endpoint disabled in production." },
    { status: 404 }
  );
}

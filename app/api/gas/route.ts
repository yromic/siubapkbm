import { GAS_API_URL } from "@/lib/config";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 30_000;

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ status: "error", code, message }, { status });
}

export async function POST(request: Request) {
  if (!GAS_API_URL) {
    return errorResponse("CONFIG_ERROR", "Backend API endpoint is not configured.", 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  try {
    const upstream = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json;charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return errorResponse(
      timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
      timedOut ? "Backend API request timed out." : "Backend API could not be reached.",
      timedOut ? 504 : 502
    );
  }
}

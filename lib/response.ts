import { NextResponse } from 'next/server';

export function successResponse(data: any, message = 'Success', status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function errorResponse(message: string, code: string, status: number, details?: any) {
  return NextResponse.json(
    { success: false, message, error: { code, details: details || null } },
    { status }
  );
}

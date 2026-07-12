import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    await db.raw('SELECT 1');
    return NextResponse.json({
      success: true,
      message: 'OK',
      data: { status: 'healthy', timestamp: new Date().toISOString() },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Database connection failed' },
      { status: 500 }
    );
  }
}

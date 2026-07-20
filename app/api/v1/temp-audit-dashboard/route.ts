import { NextRequest, NextResponse } from 'next/server';
import { countActiveStudents } from '@/lib/services/studentService';
import { getSchoolDashboard } from '@/lib/services/dashboardService';

// Force recompile trigger: 1721484550

export async function GET(req: NextRequest) {
  const result: any = {};
  
  try {
    result.countActiveStudentsVal = await countActiveStudents();
  } catch (err: any) {
    result.countActiveStudentsError = err.message;
  }

  try {
    result.getSchoolDashboardVal = await getSchoolDashboard();
  } catch (err: any) {
    result.getSchoolDashboardError = err.message;
  }

  return NextResponse.json({ success: true, result });
}

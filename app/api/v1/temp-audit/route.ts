import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAttendanceRate } from '@/lib/services/attendanceService';
import { getSppDashboardStats } from '@/lib/services/sppService';
import { getSchoolDashboard } from '@/lib/services/dashboardService';

export async function GET() {
  try {
    const auditData: any = {};

    // 1. Teacher Attendance
    const month = 7;
    const year = 2026;
    const attRateQuery = db('teacher_attendance')
      .whereNot('lifecycle_status', 'soft_deleted')
      .whereRaw('MONTH(date) = ?', [month])
      .whereRaw('YEAR(date) = ?', [year]);
    
    auditData.teacherAttendance = {
      sql: attRateQuery.toSQL().toNative(),
      allRows: await attRateQuery,
      rateResult: await getAttendanceRate(month, year),
      dbCount: await db('teacher_attendance').count('* as count').first(),
    };

    // 2. Academic Completion
    const activeYear = await db("academic_years").where("is_active", 1).first();
    const activeSemester = activeYear ? await db("semesters").where({ academic_year_id: activeYear.id, is_active: 1 }).first() : null;
    
    if (activeSemester) {
      const acadTotalQuery = db("academic_assessments")
        .where({ semester_id: activeSemester.id })
        .whereNot("lifecycle_status", "soft_deleted");
      
      const acadLockedQuery = db("academic_assessments")
        .where({ semester_id: activeSemester.id, status: "locked" })
        .whereNot("lifecycle_status", "soft_deleted");

      auditData.academicCompletion = {
        sqlTotal: acadTotalQuery.toSQL().toNative(),
        sqlLocked: acadLockedQuery.toSQL().toNative(),
        totalCount: await acadTotalQuery.count('id as count').first(),
        lockedCount: await acadLockedQuery.count('id as count').first(),
        allRows: await acadTotalQuery,
      };
    }

    // 3. SPP Stats
    const sppQuery = db('spp_payments')
      .whereNot('lifecycle_status', 'soft_deleted');
    
    auditData.spp = {
      sqlTotal: sppQuery.clone().count('id as count').toSQL().toNative(),
      sqlPaid: sppQuery.clone().whereIn('payment_status', ['paid', 'verified']).count('id as count').toSQL().toNative(),
      stats: await getSppDashboardStats(month, year),
      allRowsCount: await sppQuery.count('id as count').first(),
    };

    // 4. Best Academic Class & Best Culture Class
    const activeClasses = await db("classes").where("lifecycle_status", "active").select("id", "name");
    auditData.classes = activeClasses;
    
    // 5. Watchlist & FITRAH Radar
    if (activeSemester) {
      const watchlistQuery = db("academic_scores")
        .join("student_enrollments", "academic_scores.student_id", "student_enrollments.student_id")
        .where("student_enrollments.semester_id", activeSemester.id)
        .where("student_enrollments.status", "active")
        .whereNot("academic_scores.lifecycle_status", "soft_deleted");

      const fitrahQuery = db('character_semester_summaries')
        .where({ semester_id: activeSemester.id })
        .whereNot('lifecycle_status', 'soft_deleted');

      auditData.watchlist = {
        sql: watchlistQuery.toSQL().toNative(),
        count: await watchlistQuery.count('academic_scores.id as count').first(),
      };
      
      auditData.fitrah = {
        sql: fitrahQuery.toSQL().toNative(),
        averages: await fitrahQuery.select(
          db.raw('AVG(f_score) as f'),
          db.raw('AVG(i_score) as i'),
          db.raw('AVG(t_score) as t'),
          db.raw('AVG(r_score) as r'),
          db.raw('AVG(a_score) as a'),
          db.raw('AVG(h_score) as h')
        ).first(),
      };
    }

    // 6. Complete Dashboard Output
    auditData.dashboard = await getSchoolDashboard();

    return NextResponse.json({ success: true, auditData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack });
  }
}

'use client';

import React, { use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { StudentAttendanceSheet } from '@/components/attendance/StudentAttendanceSheet';
import { LoadingState, ForbiddenState } from '@/components/ui-states';
import { getSchoolTodayDate } from '@/lib/utils/schoolDate';

interface PageProps {
  params: Promise<{ classId: string }>;
}

function StudentAttendanceClassContent({ params }: PageProps) {
  const { classId } = use(params);
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const date = searchParams.get('date') || getSchoolTodayDate();

  if (loading) {
    return <LoadingState message="Memeriksa sesi pengguna..." />;
  }

  if (!user) {
    return <ForbiddenState message="Anda harus masuk untuk mengakses presensi siswa." />;
  }

  return (
    <StudentAttendanceSheet
      classId={classId}
      date={date}
      backHref={`/student-attendance?date=${date}`}
      userRole={user.role}
    />
  );
}

export default function StudentAttendanceClassPage(props: PageProps) {
  return (
    <Suspense fallback={<LoadingState message="Memuat lembar presensi..." />}>
      <StudentAttendanceClassContent {...props} />
    </Suspense>
  );
}

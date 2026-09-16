'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  StudentAttendanceClassItem,
  StudentAttendanceDashboardOverview,
} from '@/types/studentAttendance';
import {
  fetchAttendanceClasses,
  fetchAttendanceDashboard,
} from '@/lib/api/studentAttendance';
import { TeacherAttendanceLanding } from '@/components/attendance/TeacherAttendanceLanding';
import { AdminAttendanceDashboard } from '@/components/attendance/AdminAttendanceDashboard';
import { StudentAttendanceSheet } from '@/components/attendance/StudentAttendanceSheet';
import {
  PageHeader,
  LoadingState,
  ErrorState,
  ForbiddenState,
} from '@/components/ui-states';
import {
  getSchoolTodayDate,
  formatIndonesianDate,
  isFutureDate,
} from '@/lib/utils/schoolDate';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

function StudentAttendanceContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Date selection state (Asia/Jakarta / WIB)
  const initialDate = searchParams.get('date') || getSchoolTodayDate();
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // Selected class state
  const selectedClassId = searchParams.get('classId');

  // Teacher classes state
  const [teacherClasses, setTeacherClasses] = useState<
    StudentAttendanceClassItem[]
  >([]);

  // Admin dashboard state
  const [adminDashboard, setAdminDashboard] =
    useState<StudentAttendanceDashboardOverview | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin =
    user?.role === 'administrator' || user?.role === 'admin';

  // Load overview data for the selected date
  const loadOverview = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);

      if (isAdmin) {
        const dashData = await fetchAttendanceDashboard(selectedDate);
        setAdminDashboard(dashData);
      } else {
        const classesData = await fetchAttendanceClasses(selectedDate);
        setTeacherClasses(classesData.classes);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data presensi.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, selectedDate]);

  useEffect(() => {
    if (!authLoading && user && !selectedClassId) {
      loadOverview();
    }
  }, [authLoading, user, selectedDate, selectedClassId, loadOverview]);

  // Handle class selection
  const handleSelectClass = (classId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('classId', classId);
    params.set('date', selectedDate);
    router.push(`/student-attendance?${params.toString()}`);
  };

  // Handle back from attendance sheet
  const handleBackToLanding = () => {
    const params = new URLSearchParams();
    params.set('date', selectedDate);
    router.push(`/student-attendance?${params.toString()}`);
  };

  // Change date by offset (e.g. -1 for yesterday, +1 for tomorrow if not in future)
  const handleOffsetDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const newDateStr = `${year}-${month}-${day}`;

    if (days > 0 && isFutureDate(newDateStr)) {
      return;
    }

    setSelectedDate(newDateStr);
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', newDateStr);
    router.push(`/student-attendance?${params.toString()}`);
  };

  const handleDateChange = (newDate: string) => {
    if (isFutureDate(newDate)) return;
    setSelectedDate(newDate);
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', newDate);
    router.push(`/student-attendance?${params.toString()}`);
  };

  if (authLoading) {
    return <LoadingState message="Memeriksa sesi pengguna..." />;
  }

  if (!user) {
    return <ForbiddenState message="Anda harus masuk untuk mengakses presensi siswa." />;
  }

  // If a class is selected, show authoritative attendance sheet
  if (selectedClassId) {
    return (
      <StudentAttendanceSheet
        classId={selectedClassId}
        date={selectedDate}
        onBack={handleBackToLanding}
        userRole={user.role}
      />
    );
  }

  const todayStr = getSchoolTodayDate();
  const isToday = selectedDate === todayStr;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Presensi Siswa"
        description={
          isAdmin
            ? 'Monitoring presensi harian seluruh kelas dan koreksi administratif.'
            : 'Isi dan pantau presensi harian kelas yang Anda ampu sebagai wali kelas.'
        }
        actions={
          /* Date Switcher */
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <button
              type="button"
              onClick={() => handleOffsetDate(-1)}
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
              title="Hari Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 px-2">
              <Calendar className="w-4 h-4 text-brand-emerald-600 dark:text-brand-emerald-400" />
              <input
                type="date"
                max={todayStr}
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="text-xs md:text-sm font-bold font-plus-jakarta bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              disabled={isToday}
              onClick={() => handleOffsetDate(1)}
              className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Hari Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => handleDateChange(todayStr)}
                className="px-2.5 py-1 text-xs font-bold font-plus-jakarta rounded-xl bg-brand-emerald-50 dark:bg-brand-emerald-950/40 text-brand-emerald-700 dark:text-brand-emerald-400 hover:bg-brand-emerald-100 transition-colors"
              >
                Hari Ini
              </button>
            )}
          </div>
        }
      />

      {/* Content Area */}
      {loading ? (
        <LoadingState message="Memuat ringkasan presensi harian..." />
      ) : error ? (
        <ErrorState
          title="Gagal Memuat Presensi"
          message={error}
          onRetry={loadOverview}
        />
      ) : isAdmin && adminDashboard ? (
        <AdminAttendanceDashboard
          data={adminDashboard}
          onSelectClass={handleSelectClass}
        />
      ) : (
        <TeacherAttendanceLanding
          classes={teacherClasses}
          date={selectedDate}
          onSelectClass={handleSelectClass}
        />
      )}
    </div>
  );
}

export default function StudentAttendancePage() {
  return (
    <Suspense fallback={<LoadingState message="Menyiapkan halaman presensi..." />}>
      <StudentAttendanceContent />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StudentAttendanceDetail,
  StudentAttendanceStatus,
  SaveStudentAttendancePayload,
} from '@/types/studentAttendance';
import {
  fetchClassAttendanceDetail,
  saveClassAttendanceApi,
} from '@/lib/api/studentAttendance';
import { AttendanceStatusSelector } from './AttendanceStatusSelector';
import { formatIndonesianDate } from '@/lib/utils/schoolDate';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui-states';
import { notify } from '@/lib/notify';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Lock,
  Search,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';

interface StudentAttendanceSheetProps {
  classId: string;
  date: string;
  onBack?: () => void;
  backHref?: string;
  userRole?: string;
}

interface LocalStudentRecord {
  student_id: string;
  student_enrollment_id: string;
  full_name: string;
  nisn: string | null;
  status: StudentAttendanceStatus;
  note: string;
  is_new_roster_addition?: boolean;
}

export function StudentAttendanceSheet({
  classId,
  date,
  onBack,
  backHref = '/student-attendance',
  userRole = 'teacher',
}: StudentAttendanceSheetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentAttendanceDetail | null>(null);

  // Local editable records state (perserves teacher input on failed saves)
  const [records, setRecords] = useState<LocalStudentRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Fetch attendance detail from API
  const loadAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchClassAttendanceDetail(classId, date);
      setDetail(data);

      // Initialize local editable state from server response
      const initialLocalRecords: LocalStudentRecord[] = data.records.map((r) => ({
        student_id: r.student_id,
        student_enrollment_id: r.student_enrollment_id,
        full_name: r.full_name,
        nisn: r.nisn,
        status: r.status,
        note: r.note || '',
        is_new_roster_addition: r.is_new_roster_addition,
      }));

      setRecords(initialLocalRecords);
      setIsDirty(false);

      // Expand notes that already have content
      const noteMap: Record<string, boolean> = {};
      data.records.forEach((r) => {
        if (r.note && r.note.trim()) {
          noteMap[r.student_id] = true;
        }
      });
      setExpandedNotes(noteMap);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data presensi kelas.');
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Update status for a specific student
  const handleStatusChange = (studentId: string, newStatus: StudentAttendanceStatus) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.student_id === studentId) {
          return { ...r, status: newStatus };
        }
        return r;
      })
    );
    setIsDirty(true);
  };

  // Update note for a specific student
  const handleNoteChange = (studentId: string, noteText: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.student_id === studentId) {
          return { ...r, note: noteText };
        }
        return r;
      })
    );
    setIsDirty(true);
  };

  // Toggle note input field visibility
  const toggleNote = (studentId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // Quick reset all students to Hadir
  const handleResetAllHadir = () => {
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status: 'hadir' as StudentAttendanceStatus,
      }))
    );
    setIsDirty(true);
    notify.info('Semua murid disetel ke Hadir.');
  };

  // Live calculated summary from current records in memory
  const summary = useMemo(() => {
    const counts = {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
      terlambat: 0,
    };
    for (const r of records) {
      if (r.status in counts) {
        counts[r.status]++;
      }
    }
    const total = records.length;
    const rate =
      total > 0
        ? Number((((counts.hadir + counts.terlambat) / total) * 100).toFixed(1))
        : 0;

    return { ...counts, total, rate };
  }, [records]);

  // Filtered records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.nisn && r.nisn.toLowerCase().includes(q))
    );
  }, [records, searchQuery]);

  // Handle Save
  const handleSave = async () => {
    if (!detail) return;
    if (detail.can_edit === false) {
      notify.error('Presensi terkunci. Anda tidak memiliki izin untuk mengubah.');
      return;
    }

    try {
      setIsSaving(true);
      const payload: SaveStudentAttendancePayload = {
        attendance_date: date,
        records: records.map((r) => ({
          student_id: r.student_id,
          status: r.status,
          note: r.note.trim() === '' ? null : r.note.trim(),
        })),
      };

      const updated = await saveClassAttendanceApi(classId, payload);
      setDetail(updated);
      setIsDirty(false);
      notify.success(
        updated.updated_by
          ? 'Perubahan presensi berhasil disimpan.'
          : 'Presensi kelas berhasil disimpan.'
      );
    } catch (err: any) {
      // KEEP LOCAL RECORDS DIRTY - DO NOT RESET
      notify.error(err.message || 'Gagal menyimpan presensi kelas.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Memuat lembar presensi kelas..." />;
  }

  if (error || !detail) {
    return (
      <ErrorState
        title="Gagal Memuat Presensi"
        message={error || 'Terjadi kesalahan saat memuat lembar presensi.'}
        onRetry={loadAttendance}
      />
    );
  }

  const isAdmin = userRole === 'administrator' || userRole === 'admin';
  const isLocked = !detail.can_edit;

  return (
    <div className="space-y-6 pb-28">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link
              href={backHref}
              className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold font-plus-jakarta text-zinc-900 dark:text-zinc-100">
                Presensi Kelas {detail.class_name}
              </h1>
              {detail.has_submitted ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sudah Presensi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <Clock className="w-3.5 h-3.5" />
                  Belum Disimpan
                </span>
              )}

              {isLocked && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                  <Lock className="w-3.5 h-3.5" />
                  Semester Terkunci
                </span>
              )}
            </div>

            <p className="text-sm font-plus-jakarta text-zinc-500 dark:text-zinc-400 mt-0.5">
              {formatIndonesianDate(detail.attendance_date)} • Semester{' '}
              {detail.semester_name} {detail.academic_year_name}
            </p>
          </div>
        </div>

        {/* Audit info if session exists */}
        {detail.has_submitted && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            {detail.recorded_by_name && (
              <p>
                Dicatat oleh:{' '}
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {detail.recorded_by_name}
                </span>
              </p>
            )}
            {detail.updated_by_name && (
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Dikoreksi oleh: {detail.updated_by_name}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Lock warning banner if cannot edit */}
      {isLocked && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            Semester ini tidak aktif atau telah terkunci. Pengubahan presensi hanya dapat
            dilakukan oleh Administrator melalui koreksi administratif.
          </p>
        </div>
      )}

      {/* 2. Quick Toolbar: Search & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari murid (nama atau NISN)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-emerald-500"
          />
        </div>

        {!isLocked && (
          <button
            type="button"
            onClick={handleResetAllHadir}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Setel semua murid ke status Hadir"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Setel Semua Hadir
          </button>
        )}
      </div>

      {/* 3. Student Attendance List */}
      {filteredRecords.length === 0 ? (
        <EmptyState
          title="Tidak Ada Murid"
          description={
            searchQuery
              ? 'Tidak ada murid yang cocok dengan pencarian.'
              : 'Belum ada murid aktif yang terdaftar dalam kelas untuk tanggal ini.'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((student, idx) => {
            const hasNote = Boolean(student.note && student.note.trim());
            const isNoteExpanded = Boolean(expandedNotes[student.student_id]);

            return (
              <div
                key={student.student_id}
                className={`
                  p-4 rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-150
                  ${
                    student.status !== 'hadir'
                      ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-zinc-200 dark:border-zinc-800/80 shadow-xs'
                  }
                `}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Student Identity */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm md:text-base font-bold font-plus-jakarta text-zinc-900 dark:text-zinc-100 truncate">
                          {student.full_name}
                        </h4>
                        {student.is_new_roster_addition && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            <Sparkles className="w-3 h-3" />
                            Murid Baru Terdaftar
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        NISN: {student.nisn || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Status Selector & Note Toggle */}
                  <div className="flex items-center gap-2 justify-between lg:justify-end flex-wrap">
                    <AttendanceStatusSelector
                      value={student.status}
                      onChange={(newStatus) =>
                        handleStatusChange(student.student_id, newStatus)
                      }
                      disabled={isLocked || isSaving}
                    />

                    <button
                      type="button"
                      onClick={() => toggleNote(student.student_id)}
                      className={`
                        p-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer
                        ${
                          hasNote
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                        }
                      `}
                      title={hasNote ? 'Ubah Catatan' : 'Tambah Catatan'}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {hasNote ? 'Catatan' : 'Catatan'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Note Input */}
                {(isNoteExpanded || hasNote) && (
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={255}
                      disabled={isLocked || isSaving}
                      placeholder="Catatan (contoh: Sakit demam, Izin ada acara keluarga, Terlambat macet)..."
                      value={student.note}
                      onChange={(e) =>
                        handleNoteChange(student.student_id, e.target.value)
                      }
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-brand-emerald-500"
                    />
                    {student.note && (
                      <span className="text-[10px] text-zinc-400">
                        {student.note.length}/255
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Real-time Summary Counters */}
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto w-full sm:w-auto py-1">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-plus-jakarta text-xs font-bold shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {summary.hadir} Hadir
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-plus-jakarta text-xs font-bold shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {summary.sakit} Sakit
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-plus-jakarta text-xs font-bold shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {summary.izin} Izin
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-plus-jakarta text-xs font-bold shrink-0">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {summary.alpa} Alpa
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-plus-jakarta text-xs font-bold shrink-0">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              {summary.terlambat} Terlambat
            </div>
            <div className="hidden lg:block text-xs font-semibold text-zinc-500 dark:text-zinc-400 pl-2">
              Kehadiran: {summary.rate}%
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {isDirty && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium hidden md:inline">
                Ada perubahan belum disimpan
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLocked}
              className={`
                w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-plus-jakarta font-bold text-sm text-white shadow-md transition-all
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                ${
                  detail.has_submitted
                    ? 'bg-brand-emerald-600 hover:bg-brand-emerald-700'
                    : 'bg-brand-emerald-600 hover:bg-brand-emerald-700'
                }
              `}
            >
              <Save className="w-4 h-4" />
              {isSaving
                ? 'Menyimpan...'
                : detail.has_submitted
                ? 'Simpan Perubahan'
                : 'Simpan Presensi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

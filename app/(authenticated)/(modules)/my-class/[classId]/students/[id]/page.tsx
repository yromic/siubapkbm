"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  ResponsiveContainer,
  LoadingState,
  ForbiddenState,
} from "@/components/ui-states";
import { getStudentDetail, StudentSummary } from "@/lib/api/students";
import { StudentFilesPanel } from "@/components/student-files-panel";

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-4 py-2.5 border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
      <dt className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 pt-0.5">
        {label}
      </dt>
      <dd
        className={`text-sm flex-1 ${
          value
            ? "text-zinc-900 dark:text-zinc-100"
            : "text-zinc-400 dark:text-zinc-600 italic"
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

export default function StudentDetailTeacherPage() {
  const { classId, id } = useParams<{ classId: string; id: string }>();
  const searchParams = useSearchParams();
  const academicYearId = searchParams.get("year") ?? "";
  const semesterId = searchParams.get("sem") ?? "";

  const { token, user } = useAuth();
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudent = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      // Backend applies teacher-role field sanitization automatically
      const data = (await getStudentDetail(id, token)) as StudentSummary;
      setStudent(data);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Gagal memuat data siswa.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    setTimeout(() => loadStudent(), 0);
  }, [loadStudent]);

  if (!user || user.role !== "teacher") {
    return (
      <ForbiddenState message="Halaman ini hanya dapat diakses oleh Guru Wali Kelas." />
    );
  }

  if (loading) return <LoadingState message="Memuat data siswa..." />;

  return (
    <ResponsiveContainer className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link
          href={`/my-class/${classId}?year=${academicYearId}&sem=${semesterId}`}
          className="mt-1 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight">
            {student?.full_name ?? "Profil Siswa"}
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            NISN: {student?.nisn ?? "—"}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Role notice */}
      <div className="p-3.5 rounded-[12px] bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-400">
        Anda melihat profil dasar siswa. Data sensitif (NIK, KK, alamat, data orang tua) tidak tersedia untuk peran Guru.
      </div>

      {student && (
        <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            Profil Dasar
          </h3>
          <dl>
            <DataRow label="Nama Lengkap" value={student.full_name} />
            <DataRow label="NISN" value={student.nisn} />
            <DataRow label="Tempat Lahir" value={student.birth_place} />
            <DataRow
              label="Tanggal Lahir"
              value={
                student.birth_date
                  ? new Date(student.birth_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : undefined
              }
            />
            <DataRow
              label="Jenis Kelamin"
              value={
                student.gender === "L"
                  ? "Laki-laki"
                  : student.gender === "P"
                  ? "Perempuan"
                  : undefined
              }
            />
            <DataRow label="Agama" value={student.religion} />
            <DataRow label="No. Telepon" value={student.phone} />
            <DataRow label="Status" value={student.status} />
          </dl>
        </div>
      )}

      {student && token && (
        <StudentFilesPanel
          studentId={id}
          token={token}
          user={user}
          mode="teacher"
        />
      )}
    </ResponsiveContainer>
  );
}

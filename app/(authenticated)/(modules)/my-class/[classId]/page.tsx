"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  ResponsiveContainer,
  LoadingState,
  EmptyState,
  ForbiddenState,
} from "@/components/ui-states";
import { listStudentsByClass, StudentSummary } from "@/lib/api/students";

type StudentStatus = string;

function StatusBadge({ status }: { status: StudentStatus }) {
  const isActive = status === "Aktif";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isActive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {status}
    </span>
  );
}

export default function MyClassRosterPage() {
  const { classId } = useParams<{ classId: string }>();
  const searchParams = useSearchParams();
  const academicYearId = searchParams.get("year") ?? "";
  const semesterId = searchParams.get("sem") ?? "";

  const { token, user } = useAuth();

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadRoster = useCallback(async () => {
    if (!token || !classId) return;
    if (!academicYearId || !semesterId) {
      setStudents([]);
      setLoading(false);
      setError("Periode kelas tidak lengkap. Buka kelas melalui halaman Kelas Saya.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listStudentsByClass(
        classId,
        academicYearId,
        semesterId,
        token
      );
      setStudents(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat daftar siswa.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, classId, academicYearId, semesterId]);

  useEffect(() => {
    setTimeout(() => loadRoster(), 0);
  }, [loadRoster]);

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.full_name.toLowerCase().includes(q) ||
      s.nisn.toLowerCase().includes(q)
    );
  });

  if (!user || user.role !== "teacher") {
    return (
      <ForbiddenState message="Halaman ini hanya dapat diakses oleh Guru Wali Kelas." />
    );
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Daftar Siswa Kelas"
        description={
          academicYearId && semesterId
            ? `Kelas ID: ${classId}`
            : "Kelas Anda"
        }
        actions={
          <Link
            href="/my-class"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Kelas Saya
          </Link>
        }
      />

      {/* Info banner */}
      <div className="p-3.5 rounded-[12px] bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-400">
        <strong>Catatan:</strong> Anda melihat data siswa terbatas sesuai hak akses Guru Wali Kelas.
        Data sensitif (NIK, KK, Akta) tidak ditampilkan.
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Cari nama atau NISN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432]"
        />
      </div>

      {loading && <LoadingState message="Memuat daftar siswa..." />}

      {error && (
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={search ? "Tidak Ada Hasil" : "Kelas Kosong"}
          description={
            search
              ? "Coba ubah kata kunci pencarian."
              : "Tidak ada siswa aktif di kelas ini."
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-5 py-3.5">#</th>
                  <th className="px-5 py-3.5">Nama Siswa</th>
                  <th className="px-5 py-3.5">NISN</th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Kelamin</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map((student, idx) => (
                  <tr
                    key={student.id}
                    className="hover:bg-zinc-50/60 dark:hover:bg-[#262626]/40 transition-colors"
                  >
                    <td className="px-5 py-4 text-zinc-400 text-xs">{idx + 1}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {student.full_name}
                      </div>
                      {student.birth_date && (
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {new Date(student.birth_date).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-zinc-600 dark:text-zinc-400 text-sm">
                      {student.nisn}
                    </td>
                    <td className="px-5 py-4 text-zinc-500 hidden sm:table-cell">
                      {student.gender === "L"
                        ? "Laki-laki"
                        : student.gender === "P"
                        ? "Perempuan"
                        : "-"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={student.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/my-class/${classId}/students/${student.id}?year=${academicYearId}&sem=${semesterId}`}
                        className="text-xs font-semibold text-[#468432] hover:text-emerald-700 dark:text-emerald-400 transition-colors"
                      >
                        Lihat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            {filtered.length} dari {students.length} siswa
          </div>
        </div>
      )}
    </ResponsiveContainer>
  );
}

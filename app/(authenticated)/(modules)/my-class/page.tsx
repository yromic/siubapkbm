"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  ResponsiveContainer,
  LoadingState,
  EmptyState,
  ForbiddenState,
} from "@/components/ui-states";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";

export default function MyClassPage() {
  const { token, user } = useAuth();

  const [assignments, setAssignments] = useState<MyClassAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    setError(null);
    try {
      const myClasses = await getMyClasses(token);
      setAssignments(myClasses);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data kelas.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    setTimeout(() => loadData(), 0);
  }, [loadData]);

  // Guard for teacher only
  if (!user || user.role !== "teacher") {
    return (
      <ForbiddenState message="Halaman ini hanya dapat diakses oleh Guru Wali Kelas." />
    );
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Kelas Saya"
        description="Daftar kelas yang Anda ampu sebagai wali kelas."
      />

      {loading && <LoadingState message="Memuat data kelas..." />}

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && assignments.length === 0 && (
        <EmptyState
          title="Belum Ada Penugasan"
          description="Anda belum ditugaskan sebagai wali kelas di semester yang aktif."
        />
      )}

      {!loading && !error && assignments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((a) => {
            const className = `${a.class_name}${a.class_code ? ` (${a.class_code})` : ""}`;

            return (
              <Link
                key={a.assignment_id}
                href={`/my-class/${a.class_id}?year=${a.academic_year_id}&sem=${a.semester_id}`}
                className="group block bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-brand-emerald-600 dark:text-emerald-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    Aktif
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-brand-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {className}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {a.academic_year_name} • {a.semester_name}
                </p>
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {a.effective_from
                      ? `Mulai: ${new Date(a.effective_from).toLocaleDateString("id-ID")}`
                      : "Lihat siswa →"}
                  </span>
                  <svg className="w-4 h-4 text-zinc-400 group-hover:text-[#468432] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </ResponsiveContainer>
  );
}

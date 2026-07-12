"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageHeader,
  ResponsiveContainer,
} from "@/components/ui-states";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";
import {
  AcademicAssessment,
  AssessmentStatus,
  MyClassSubject,
  listAcademicAssessments,
  listMyClassSubjects,
} from "@/lib/api/academic";

const STATUS_LABELS: Record<AssessmentStatus, string> = {
  draft: "Draf",
  published: "Diterbitkan",
  locked: "Terkunci",
};

function StatusBadge({ status }: { status: AssessmentStatus | string }) {
  const styles =
    status === "published"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450"
      : status === "locked"
      ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-350"
      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-450";

  const isLocked = status === "locked";

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles}`}>
      {isLocked && (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )}
      {STATUS_LABELS[status as AssessmentStatus] ?? status}
    </span>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AcademicScoresPage() {
  const { token, user } = useAuth();
  const [classes, setClasses] = useState<MyClassAssignment[]>([]);
  const [subjects, setSubjects] = useState<MyClassSubject[]>([]);
  const [assessments, setAssessments] = useState<AcademicAssessment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedClass = classes.find((item) => item.class_id === selectedClassId);

  const loadData = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    setError(null);
    try {
      const myClasses = await getMyClasses(token);
      setClasses(myClasses);

      const allAssessments = await listAcademicAssessments(token);
      setAssessments(allAssessments);

      const subjectGroups = await Promise.all(
        myClasses.map((item) =>
          listMyClassSubjects(token, {
            class_id: item.class_id,
            academic_year_id: item.academic_year_id,
            semester_id: item.semester_id,
          }).catch(() => [])
        )
      );
      const subjectMap = new Map<string, MyClassSubject>();
      subjectGroups.flat().forEach((subject) => {
        subjectMap.set(`${subject.class_id}:${subject.subject_id}`, subject);
      });
      setSubjects(Array.from(subjectMap.values()));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat daftar assessment.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    setTimeout(() => loadData(), 0);
  }, [loadData]);

  const subjectOptions = useMemo(() => {
    if (!selectedClassId) return subjects;
    return subjects.filter((item) => item.class_id === selectedClassId);
  }, [selectedClassId, subjects]);

  const filteredAssessments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assessments.filter((assessment) => {
      const matchesClass = !selectedClassId || assessment.class_id === selectedClassId;
      const matchesSubject = !selectedSubjectId || assessment.subject_id === selectedSubjectId;
      const matchesStatus = !selectedStatus || assessment.status === selectedStatus;
      const matchesSearch = !query || assessment.title.toLowerCase().includes(query);
      return matchesClass && matchesSubject && matchesStatus && matchesSearch;
    });
  }, [assessments, search, selectedClassId, selectedStatus, selectedSubjectId]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((item) => {
      map.set(item.class_id, `${item.class_name}${item.class_code ? ` (${item.class_code})` : ""}`);
    });
    return map;
  }, [classes]);

  const subjectNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    subjects.forEach((item) => {
      map.set(`${item.class_id}:${item.subject_id}`, `${item.subject_name}${item.subject_code ? ` (${item.subject_code})` : ""}`);
    });
    return map;
  }, [subjects]);

  if (!user || user.role !== "teacher") {
    return <ForbiddenState message="Halaman Nilai Akademik hanya dapat diakses oleh Guru Wali Kelas." />;
  }

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Nilai Akademik"
        description="Kelola penilaian akademik untuk kelas yang Anda ampu."
        actions={
          <Link
            href="/academic-scores/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Buat Penilaian
          </Link>
        }
      />

      {loading && <LoadingState message="Memuat penilaian akademik..." />}

      {!loading && error && <ErrorState message={error} onRetry={loadData} />}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={selectedClassId}
              onChange={(event) => {
                setSelectedClassId(event.target.value);
                setSelectedSubjectId("");
              }}
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
            >
              <option value="">Semua kelas</option>
              {classes.map((item) => (
                <option key={item.assignment_id} value={item.class_id}>
                  {item.class_name} {item.class_code ? `(${item.class_code})` : ""}
                </option>
              ))}
            </select>

            <select
              value={selectedSubjectId}
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
            >
              <option value="">Semua mapel</option>
              {subjectOptions.map((item) => (
                <option key={`${item.class_subject_id}:${item.subject_id}`} value={item.subject_id}>
                  {item.subject_name} {item.subject_code ? `(${item.subject_code})` : ""}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
            >
              <option value="">Semua status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="locked">Locked</option>
            </select>

            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari judul..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
              />
            </div>
          </div>

          {classes.length === 0 && (
            <EmptyState
              title="Belum Ada Kelas"
              description="Anda belum memiliki assignment kelas aktif untuk periode berjalan."
            />
          )}

          {classes.length > 0 && filteredAssessments.length === 0 && (
            <EmptyState
              title="Belum Ada Penilaian"
              description="Belum ada penilaian yang cocok dengan filter saat ini."
            />
          )}

          {filteredAssessments.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredAssessments.map((assessment) => {
                const classLabel = classNameById.get(assessment.class_id) || assessment.class_id;
                const subjectLabel = subjectNameByKey.get(`${assessment.class_id}:${assessment.subject_id}`) || assessment.subject_id;
                const href = `/academic-scores/${assessment.id}`;
                return (
                  <Link
                    key={assessment.id}
                    href={href}
                    className="block bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-4 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50 truncate">
                          {assessment.title}
                        </h2>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {classLabel} / {subjectLabel}
                        </p>
                      </div>
                      <StatusBadge status={assessment.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-[12px] bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 p-3">
                        <div className="text-zinc-400 font-semibold uppercase">Tanggal</div>
                        <div className="mt-1 font-semibold text-zinc-800 dark:text-zinc-100">{formatDate(assessment.assessment_date)}</div>
                      </div>
                      <div className="rounded-[12px] bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800 p-3">
                        <div className="text-zinc-400 font-semibold uppercase">Rentang Nilai</div>
                        <div className="mt-1 font-semibold text-zinc-800 dark:text-zinc-100">
                          {assessment.score_min} - {assessment.score_max}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {selectedClass && (
            <p className="text-xs text-zinc-400">
              Filter aktif menggunakan kelas {selectedClass.class_name} pada {selectedClass.academic_year_name}, Semester {selectedClass.semester_name}.
            </p>
          )}
        </>
      )}
    </ResponsiveContainer>
  );
}

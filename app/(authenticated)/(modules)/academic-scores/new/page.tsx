"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageHeader,
  ResponsiveContainer,
} from "@/components/ui-states";
import { DatePicker } from "@/components/ui/date-picker";
import { notify } from "@/lib/notify";
import { humanizeError } from "@/lib/utils/ui-error";
import { getMyClasses, MyClassAssignment } from "@/lib/api/my-class";
import {
  MyClassSubject,
  createAcademicAssessment,
  listMyClassSubjects,
} from "@/lib/api/academic";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function CreateAcademicAssessmentPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [classes, setClasses] = useState<MyClassAssignment[]>([]);
  const [subjects, setSubjects] = useState<MyClassSubject[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(todayString());
  const [scoreMin, setScoreMin] = useState("0");
  const [scoreMax, setScoreMax] = useState("100");
  const [loading, setLoading] = useState(true);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const selectedClass = useMemo(
    () => classes.find((item) => item.class_id === classId) || null,
    [classId, classes]
  );

  const loadClasses = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    setError(null);
    try {
      const myClasses = await getMyClasses(token);
      setClasses(myClasses);
      if (myClasses.length === 1) {
        setClassId(myClasses[0].class_id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memuat kelas Anda.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    setTimeout(() => loadClasses(), 0);
  }, [loadClasses]);

  useEffect(() => {
    if (!token || !selectedClass) {
      setTimeout(() => {
        setSubjects([]);
        setSubjectId("");
        setSubjectError(null);
      }, 0);
      return;
    }

    setTimeout(() => {
      setSubjectLoading(true);
      setSubjectError(null);
      setFormError(null);
      listMyClassSubjects(token, {
        class_id: selectedClass.class_id,
        academic_year_id: selectedClass.academic_year_id,
        semester_id: selectedClass.semester_id,
      })
        .then((data) => {
          setSubjects(data);
          setSubjectId(data.length === 1 ? data[0].subject_id : "");
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Gagal memuat mapel kelas.";
          setSubjectError(message);
          setSubjects([]);
          setSubjectId("");
        })
        .finally(() => setSubjectLoading(false));
    }, 0);
  }, [selectedClass, token]);

  const validateForm = () => {
    if (!selectedClass) return "Kelas wajib dipilih.";
    if (!subjectId) return "Mata pelajaran wajib dipilih.";
    if (!title.trim()) return "Judul penilaian wajib diisi.";
    if (!assessmentDate) return "Tanggal penilaian wajib diisi.";

    const min = Number(scoreMin);
    const max = Number(scoreMax);
    if (Number.isNaN(min) || Number.isNaN(max)) return "Rentang nilai harus berupa angka.";
    if (min > max) return "Score minimum tidak boleh lebih besar dari score maksimum.";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !selectedClass) return;

    const validationMessage = validateForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const created = await createAcademicAssessment(
        {
          class_id: selectedClass.class_id,
          subject_id: subjectId,
          academic_year_id: selectedClass.academic_year_id,
          semester_id: selectedClass.semester_id,
          title: title.trim(),
          description: description.trim(),
          assessment_date: assessmentDate,
          score_min: Number(scoreMin),
          score_max: Number(scoreMax),
        },
        token
      );
      notify.success("Penilaian berhasil dibuat.");
      router.push(`/academic-scores/${created.id}`);
    } catch (err: unknown) {
      setFormError(humanizeError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== "teacher") {
    return <ForbiddenState message="Halaman ini hanya dapat diakses oleh Guru Wali Kelas." />;
  }

  if (loading) return <LoadingState message="Memuat kelas Anda..." />;

  return (
    <ResponsiveContainer className="space-y-6">
      <PageHeader
        title="Buat Penilaian"
        description="Penilaian hanya dapat dibuat untuk kelas dan mata pelajaran yang Anda ampu."
        actions={
          <Link
            href="/academic-scores"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Nilai Akademik
          </Link>
        }
      />

      {error && <ErrorState message={error} onRetry={loadClasses} />}

      {!error && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-4 sm:p-6 shadow-sm space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Kelas
              </label>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
              >
                <option value="">Pilih kelas</option>
                {classes.map((item) => (
                  <option key={item.assignment_id} value={item.class_id}>
                    {item.class_name} {item.class_code ? `(${item.class_code})` : ""} / {item.academic_year_name} Semester {item.semester_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Mata Pelajaran
              </label>
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                disabled={!selectedClass || subjectLoading}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 disabled:opacity-60"
              >
                <option value="">{subjectLoading ? "Memuat mapel..." : "Pilih mapel"}</option>
                {subjects.map((item) => (
                  <option key={item.class_subject_id} value={item.subject_id}>
                    {item.subject_name} {item.subject_code ? `(${item.subject_code})` : ""}
                  </option>
                ))}
              </select>
              {subjectLoading && (
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 animate-ping"></span>
                  Memuat daftar mata pelajaran...
                </p>
              )}
              {subjectError && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                  ⚠️ {subjectError}
                </p>
              )}
              {selectedClass && !subjectLoading && !subjectError && subjects.length === 0 && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 leading-relaxed font-medium">
                  ⚠️ Belum ada mata pelajaran yang dihubungkan ke kelas ini pada tahun ajaran dan semester terpilih. Silakan hubungkan mapel ke kelas melalui menu Mapel Kelas terlebih dahulu.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Judul
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Contoh: Project Poster Lingkungan"
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Deskripsi
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Deskripsi singkat penilaian"
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <DatePicker
                label="Tanggal"
                value={assessmentDate}
                onChange={setAssessmentDate}
                placeholder="Pilih tanggal..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Score Min
              </label>
              <input
                type="number"
                value={scoreMin}
                onChange={(event) => setScoreMin(event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Score Max
              </label>
              <input
                type="number"
                value={scoreMax}
                onChange={(event) => setScoreMax(event.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30"
              />
            </div>
          </div>

          {selectedClass && (
            <div className="p-3.5 rounded-[12px] bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-400">
              Penilaian akan dibuat untuk {selectedClass.class_name}, {selectedClass.academic_year_name}, Semester {selectedClass.semester_name}.
            </div>
          )}

          {formError && (
            <div className="p-3.5 rounded-[12px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
            <Link
              href="/academic-scores"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={saving || subjectLoading}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-[#468432] hover:bg-[#3A6F2B] disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              {saving ? "Menyimpan..." : "Simpan Penilaian"}
            </button>
          </div>
        </form>
      )}
    </ResponsiveContainer>
  );
}

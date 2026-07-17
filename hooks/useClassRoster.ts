"use client";

import { useState, useCallback } from "react";
import { listStudentsByClass, StudentSummary } from "@/lib/api/students";

export function useClassRoster(
  classId: string,
  yearId: string,
  semId: string,
  token: string | null,
  errorMessagePrefix = "Periode kelas tidak lengkap. Buka kelas melalui halaman Kelas Saya."
) {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    if (!token || !classId) return;
    if (!yearId || !semId) {
      setStudents([]);
      setLoading(false);
      setError(errorMessagePrefix);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listStudentsByClass(classId, yearId, semId, token);
      setStudents(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat daftar siswa.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, classId, yearId, semId, errorMessagePrefix]);

  return {
    students,
    setStudents,
    loading,
    error,
    setError,
    loadRoster,
  };
}

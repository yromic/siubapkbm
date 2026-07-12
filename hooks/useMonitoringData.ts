"use client";

import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/api/client";
import { listUsersApi, UserWithProfile } from "@/lib/api/users";
import { getTeacherCultureCompleteness } from "@/lib/api/culture";
import { AcademicAssessment } from "@/lib/api/academic";

export interface AcademicMonitoringItem {
  id: string;
  teacherName: string;
  className: string;
  subjectName: string;
  status: "Belum Membuat Assessment" | "Belum Final" | "Final";
}

export interface CultureMonitoringItem {
  id: string;
  waliKelas: string;
  className: string;
  progress: number;
  status: "Belum Ada Input" | "Sebagian" | "Lengkap";
}

// Module-level cache to persist data across mounts/sessions
let cachedAcademicData: AcademicMonitoringItem[] | null = null;
let cachedCultureData: CultureMonitoringItem[] | null = null;

export function useMonitoringData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academicData, setAcademicData] = useState<AcademicMonitoringItem[] | null>(cachedAcademicData);
  const [cultureData, setCultureData] = useState<CultureMonitoringItem[] | null>(cachedCultureData);

  const fetchMonitoringData = useCallback(async (
    token: string,
    assessments: AcademicAssessment[],
    activeAcademicYearId?: string,
    activeSemesterId?: string
  ) => {
    // If cache already exists, do not fetch again
    if (cachedAcademicData && cachedCultureData) {
      setAcademicData(cachedAcademicData);
      setCultureData(cachedCultureData);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch relations in parallel
      const [classes, classSubjects, classTeacherAssignments, allUsers, subjects] = await Promise.all([
        apiRequest<any[]>("list_classes", {}, token),
        apiRequest<any[]>("list_class_subjects", {}, token),
        apiRequest<any[]>("list_class_teacher_assignments", {}, token),
        listUsersApi(token),
        apiRequest<any[]>("list_subjects", {}, token),
      ]);

      const teachers = allUsers.filter((u) => u.role === "teacher");
      const activeClasses = classes.filter((c) => c.status === "active");

      // Helper map for user names
      const teacherMap: Record<string, string> = {};
      teachers.forEach((t) => {
        teacherMap[t.id] = t.name || t.username || "Guru";
      });

      // Helper to clean test/system suffixes from class names
      const cleanClassName = (name: string) => {
        if (!name) return "";
        let cleaned = name.replace(/_?\d{10,}(_\d+)?/g, "").trim();
        cleaned = cleaned.replace(/[\s-_]+$/g, "").trim();
        if (cleaned.startsWith("Kelas ")) {
          return cleaned;
        }
        return `Kelas ${cleaned}`;
      };

      // Helper map for class names
      const classMap: Record<string, string> = {};
      activeClasses.forEach((c) => {
        classMap[c.id] = cleanClassName(c.name);
      });

      // Helper map for subject names & codes
      const subjectMap: Record<string, { name: string; code: string }> = {};
      subjects.forEach((s) => {
        subjectMap[s.id] = { name: s.name, code: s.code };
      });

      // Helper map to find Wali Kelas (active assignment for current semester)
      const waliKelasMap: Record<string, string> = {};
      classTeacherAssignments.forEach((assignment) => {
        if (
          assignment.status === "active" && 
          classMap[assignment.class_id] &&
          (!activeAcademicYearId || assignment.academic_year_id === activeAcademicYearId) &&
          (!activeSemesterId || assignment.semester_id === activeSemesterId)
        ) {
          waliKelasMap[assignment.class_id] = teacherMap[assignment.teacher_user_id] || "Belum Ada Wali Kelas";
        }
      });

      // 2. Aggregate Academic Monitoring (filter by active academic year and semester)
      const academicList: AcademicMonitoringItem[] = [];
      const activeClassSubjects = classSubjects.filter((cs) => 
        cs.status === "active" && 
        classMap[cs.class_id] &&
        (!activeAcademicYearId || cs.academic_year_id === activeAcademicYearId) &&
        (!activeSemesterId || cs.semester_id === activeSemesterId)
      );

      activeClassSubjects.forEach((cs) => {
        const className = classMap[cs.class_id];
        const subjectInfo = subjectMap[cs.subject_id];
        const subjectName = subjectInfo ? `${subjectInfo.name} (${subjectInfo.code})` : cs.subject_name || cs.subject_code || `Subjek: ${cs.subject_id}`;
        
        // Find assessments for this class and subject
        const relatedAssessments = assessments.filter(
          (a) => a.class_id === cs.class_id && a.subject_id === cs.subject_id &&
                 (!activeAcademicYearId || a.academic_year_id === activeAcademicYearId) &&
                 (!activeSemesterId || a.semester_id === activeSemesterId)
        );

        let status: "Belum Membuat Assessment" | "Belum Final" | "Final" = "Belum Membuat Assessment";
        let teacherName = waliKelasMap[cs.class_id] || "Guru Pengajar";

        if (relatedAssessments.length > 0) {
          // If they created assessments, use the teacher who actually created them
          const assessmentTeacherId = relatedAssessments[0].teacher_user_id;
          teacherName = teacherMap[assessmentTeacherId] || teacherName;

          const allLocked = relatedAssessments.every((a) => a.status === "locked");
          if (allLocked) {
            status = "Final";
          } else {
            status = "Belum Final";
          }
        }

        academicList.push({
          id: cs.id || `${cs.class_id}-${cs.subject_id}-${cs.academic_year_id || ""}-${cs.semester_id || ""}`,
          teacherName,
          className,
          subjectName,
          status,
        });
      });

      // 3. Aggregate Culture Monitoring
      // Fetch completeness for each active class in parallel
      const culturePromises = activeClasses.map(async (cls) => {
        const waliName = waliKelasMap[cls.id] || "Belum Ada Wali Kelas";
        try {
          const completeness = await getTeacherCultureCompleteness(token, {
            period_mode: "semester",
            class_id: cls.id,
          });

          const progress = completeness.class_summary?.average_coverage_percent || 0;
          let status: "Belum Ada Input" | "Sebagian" | "Lengkap" = "Belum Ada Input";

          if (progress === 100) {
            status = "Lengkap";
          } else if (progress > 0) {
            status = "Sebagian";
          }

          return {
            id: cls.id,
            waliKelas: waliName,
            className: cls.name,
            progress,
            status,
          };
        } catch (err) {
          console.error(`Gagal memuat kelengkapan budaya kelas ${cls.name}:`, err);
          return {
            id: cls.id,
            waliKelas: waliName,
            className: cls.name,
            progress: 0,
            status: "Belum Ada Input" as const,
          };
        }
      });

      const cultureList = await Promise.all(culturePromises);

      // Save to cache
      cachedAcademicData = academicList;
      cachedCultureData = cultureList;

      setAcademicData(academicList);
      setCultureData(cultureList);
    } catch (err: any) {
      console.error("Gagal memuat data monitoring:", err);
      setError(err?.message || "Gagal memuat data monitoring dari server.");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    cachedAcademicData = null;
    cachedCultureData = null;
    setAcademicData(null);
    setCultureData(null);
  }, []);

  return {
    loading,
    error,
    academicData,
    cultureData,
    fetchMonitoringData,
    clearCache,
  };
}

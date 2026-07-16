"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean | string;
  created_at?: string;
  updated_at?: string;
}

export interface Semester {
  id: string;
  academic_year_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean | string;
  created_at?: string;
  updated_at?: string;
}

interface SettingsContextType {
  activeAcademicYear: AcademicYear | null;
  activeSemester: Semester | null;
  academicYears: AcademicYear[];
  semesters: Semester[];
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState<AcademicYear | null>(null);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSettings = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    setError(null);
    try {
      const [years, sems, settings] = await Promise.all([
        apiRequest<AcademicYear[]>("list_academic_years", {}, token),
        apiRequest<Semester[]>("list_semesters", {}, token),
        apiRequest<Record<string, string>>("get_app_settings", {}, token),
      ]);

      const yearsData = Array.isArray(years) ? years : (years as any).data || [];
      const semsData = Array.isArray(sems) ? sems : (sems as any).data || [];

      setAcademicYears(yearsData);
      setSemesters(semsData);

      const activeYearId = settings.active_academic_year_id;
      const activeSemId = settings.active_semester_id;

      const activeY = yearsData.find((y: any) => y.id === activeYearId) || null;
      const activeS = semsData.find((s: any) => s.id === activeSemId) || null;

      setActiveAcademicYear(activeY);
      setActiveSemester(activeS);
    } catch (err: unknown) {
      console.error("Failed to load settings:", err);
      const msg = err instanceof Error ? err.message : "Gagal memuat pengaturan sistem.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (
      token && 
      user && 
      (user.role === "administrator" || user.role === "admin" || user.role === "teacher")
    ) {
      setTimeout(() => {
        refreshSettings();
      }, 0);
    } else {
      setTimeout(() => {
        setAcademicYears([]);
        setSemesters([]);
        setActiveAcademicYear(null);
        setActiveSemester(null);
        setLoading(false);
        setError(null);
      }, 0);
    }
  }, [token, user, refreshSettings]);

  return (
    <SettingsContext.Provider
      value={{
        activeAcademicYear,
        activeSemester,
        academicYears,
        semesters,
        loading,
        error,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

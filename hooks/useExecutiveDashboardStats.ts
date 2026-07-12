import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/api/client";

export interface ExecutiveDashboardStats {
  teacherAttendanceRate: number;
  sppCompletionRate: number;
  sppChartData: Array<{ name: string; Lunas: number; Belum: number }>;
  docCompletionRate: number;
  docPieChartData: Array<{ name: string; value: number }>;
  fitrahRadarData: Array<{ subject: string; A: number; fullMark: number }>;
  lastBackupTime: string;
  lastBackupStatus: string;
  lastIntegrityCheckTime: string;
  lastIntegrityCheckStatus: string;
  bestClassAcademicName: string;
  bestClassAcademicAvg: string;
  mostActiveTeacherName: string;
  mostActiveTeacherDesc: string;
  bestCultureClassName: string;
  bestCultureClassAvg: string;
  classesWithoutWali: string[];
  orphanStudentsCount: number;
  unpaidSppPercent: number;
  failedLoginsCount: number;
  classAcademicAverages: Array<{ name: string; RataRata: number }>;
}

// Global module-level cache to prevent unnecessary refetching during session
let cachedStats: ExecutiveDashboardStats | null = null;

export function useExecutiveDashboardStats() {
  const [statsData, setStatsData] = useState<ExecutiveDashboardStats | null>(cachedStats);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutiveStats = useCallback(async (token: string, forceRefresh = false) => {
    // If cache already exists and forceRefresh is false, do not fetch again
    if (cachedStats && !forceRefresh) {
      setStatsData(cachedStats);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<ExecutiveDashboardStats>(
        "get_executive_dashboard_stats",
        {},
        token
      );
      cachedStats = data;
      setStatsData(data);
    } catch (err: any) {
      console.error("Failed to load executive dashboard stats:", err);
      const msg = err instanceof Error ? err.message : "Gagal memuat statistik dashboard.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    statsData,
    loading,
    error,
    fetchExecutiveStats,
  };
}

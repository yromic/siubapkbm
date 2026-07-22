"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api/client";
import { searchAuditLogs, AuditLog } from "@/lib/api/audit-logs";
import { ForbiddenState, PageHeader, ResponsiveContainer } from "@/components/ui-states";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface AcademicYear { id: string; name: string }
interface Semester { id: string; name: string }

interface PromotionHistoryRecord {
  id: string;
  date: string;
  sourceYear: string;
  sourceSemester: string;
  targetYear: string;
  targetSemester: string;
  promoted: number;
  repeated: number;
  graduated: number;
  failed: number;
  total: number;
  executor: string;
  executorRole: string;
}

export default function PromotionHistoryPage() {
  const { token, user } = useAuth();
  const [history, setHistory] = useState<PromotionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isAdmin = user?.role === "administrator" || user?.role === "admin";

  const loadHistory = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch metadata lookup maps
      const [years, semesters, logsResponse] = await Promise.all([
        apiRequest<AcademicYear[]>("list_academic_years", {}, token),
        apiRequest<Semester[]>("list_semesters", {}, token),
        searchAuditLogs(token, { action: "PROMOTION_EXECUTION", page_size: 100 })
      ]);

      const yearsMap = new Map(years.map(y => [y.id, y.name]));
      const semestersMap = new Map(semesters.map(s => [s.id, s.name]));

      // 2. Parse logs
      const records: PromotionHistoryRecord[] = (logsResponse.logs || []).map((log: AuditLog) => {
        let payload: any = {};
        try {
          payload = typeof log.new_value === "string" ? JSON.parse(log.new_value) : log.new_value || {};
        } catch (e) {
          // ignore
        }

        const counts = payload.counts || {};
        const total = counts.processed || counts.total || 0;
        const promoted = counts.promoted || 0;
        const repeated = counts.repeated || 0;
        const graduated = counts.graduated || 0;
        const failed = counts.failed || 0;

        return {
          id: log.id,
          date: log.created_at,
          sourceYear: yearsMap.get(payload.source_academic_year_id) || "Tidak diketahui",
          sourceSemester: semestersMap.get(payload.source_semester_id) || "",
          targetYear: yearsMap.get(payload.target_academic_year_id) || "Tidak diketahui",
          targetSemester: semestersMap.get(payload.target_semester_id) || "",
          promoted,
          repeated,
          graduated,
          failed,
          total,
          executor: log.user_name || "Sistem",
          executorRole: log.user_role || "system"
        };
      });

      setHistory(records);
    } catch (err: any) {
      setError(err.message || "Gagal memuat riwayat kenaikan kelas.");
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (!isAdmin) return <ForbiddenState message="Halaman Riwayat Kenaikan Kelas hanya dapat diakses Administrator." />;

  return (
    <ResponsiveContainer className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/settings/promotion" className="flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
          <ArrowLeft size={16} /> Kembali ke Kenaikan Kelas
        </Link>
      </div>

      <PageHeader 
        title="Riwayat Kenaikan Kelas" 
        description="Catatan histori pelaksanaan kenaikan kelas (rollover) tahunan oleh Administrator." 
      />

      {error && (
        <div role="alert" className="rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-surface-1 p-5 dark:border-zinc-800">
        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-500">Memuat riwayat kenaikan kelas...</div>
        ) : history.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500">Belum ada riwayat pelaksanaan kenaikan kelas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left dark:bg-zinc-800">
                <tr>
                  <th className="p-3">Tanggal Eksekusi</th>
                  <th className="p-3">Periode Asal</th>
                  <th className="p-3">Periode Tujuan</th>
                  <th className="p-3 text-center">Naik Kelas</th>
                  <th className="p-3 text-center">Tinggal Kelas</th>
                  <th className="p-3 text-center">Lulus</th>
                  <th className="p-3 text-center">Gagal</th>
                  <th className="p-3 text-center">Total Siswa</th>
                  <th className="p-3">Eksekutor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {history.map((item) => (
                  <tr key={item.id} className="align-middle">
                    <td className="p-3 font-medium">
                      {new Date(item.date).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </td>
                    <td className="p-3">
                      {item.sourceYear} <span className="text-xs text-zinc-500">{item.sourceSemester}</span>
                    </td>
                    <td className="p-3">
                      {item.targetYear} <span className="text-xs text-zinc-500">{item.targetSemester}</span>
                    </td>
                    <td className="p-3 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.promoted}
                    </td>
                    <td className="p-3 text-center text-amber-600 dark:text-amber-400">
                      {item.repeated}
                    </td>
                    <td className="p-3 text-center text-blue-600 dark:text-blue-400">
                      {item.graduated}
                    </td>
                    <td className="p-3 text-center text-red-600 dark:text-red-400">
                      {item.failed}
                    </td>
                    <td className="p-3 text-center font-bold">
                      {item.total}
                    </td>
                    <td className="p-3">
                      <div>{item.executor}</div>
                      <div className="text-xs text-zinc-500 capitalize">{item.executorRole}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ResponsiveContainer>
  );
}

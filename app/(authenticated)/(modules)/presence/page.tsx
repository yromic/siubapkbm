"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api/client";
import { humanizeError } from "@/lib/utils/ui-error";
import { Fingerprint, Loader2, CheckCircle2, History } from "lucide-react";
import { PageHeader, ResponsiveContainer } from "@/components/ui-states";
import { Calendar } from "@/components/ui/calendar";
import { InfoBanner } from "@/components/ui/info-banner";

export default function PresencePage() {
  const { token, user } = useAuth();
  
  // Geolocation & submission state
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [attendanceDetails, setAttendanceDetails] = useState<any>(null);

  // History state
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Digital clock state
  const [time, setTime] = useState("");
  const [dateStr, setDateStr] = useState("");

  const loadHistory = async () => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const data = await apiRequest<any[]>("get_attendance_history", {}, token);
      setHistoryList(data || []);
      
      // Check if guru already checked in today
      const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).split(" ")[0];
      const hasCheckedInToday = (data || []).some((item: any) => item.date === todayStr);
      if (hasCheckedInToday) {
        setAlreadyCheckedIn(true);
      }
    } catch (err) {
      console.error("[QA LOG]", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    // Live clock update
    const updateTime = () => {
      try {
        const now = new Date();
        setTime(now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB");
        setDateStr(now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
      } catch (err) {
        console.error("[QA LOG]", err);
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [token]);

  const handleCheckIn = () => {
    try {
      setError(null);
      setSuccess(null);
      setIsLocating(true);

      if (!navigator.geolocation) {
        setError("Browser Anda tidak mendukung fitur lokasi (Geolocation).");
        setIsLocating(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          setIsLocating(false);
          setIsSubmitting(true);

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          try {
            const res = await apiRequest<any>(
              "record_attendance",
              { lat: lat, lng: lng },
              token || undefined
            );

            setSuccess("Presensi berhasil dicatat.");
            setAlreadyCheckedIn(true);
            setAttendanceDetails(res);
            await loadHistory();
          } catch (err) {
            console.error("[QA LOG]", err);
            setError(humanizeError(err));
          } finally {
            setIsSubmitting(false);
          }
        },
        (err) => {
          setIsLocating(false);
          console.error("[QA LOG]", err);
          setError(humanizeError(err));
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0
        }
      );
    } catch (err) {
      console.error("[QA LOG]", err);
      setError(humanizeError(err));
    }
  };

  // Calendar logic helpers
  const getLocalDateStr = (date: Date) => {
    return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
  };

  const isWeekday = (date: Date) => {
    const day = date.getDay();
    return day !== 0 && day !== 6; // exclude Sunday (0) and Saturday (6)
  };

  const todayStr = getLocalDateStr(new Date());

  const isHadir = (date: Date) => {
    const dStr = getLocalDateStr(date);
    return historyList.some(
      (item) => item.date === dStr && (item.status || "").toLowerCase() === "hadir"
    );
  };

  const isIzinSakit = (date: Date) => {
    const dStr = getLocalDateStr(date);
    return historyList.some(
      (item) =>
        item.date === dStr &&
        ["sakit", "izin", "dinas"].includes((item.status || "").toLowerCase())
    );
  };

  const isAlpa = (date: Date) => {
    const dStr = getLocalDateStr(date);
    const isPast = dStr < todayStr;
    const inHistory = historyList.some((item) => item.date === dStr);
    return isPast && isWeekday(date) && !inHistory;
  };

  const isTodayPending = (date: Date) => {
    const dStr = getLocalDateStr(date);
    const isToday = dStr === todayStr;
    const inHistory = historyList.some((item) => item.date === dStr);
    return isToday && isWeekday(date) && !inHistory;
  };

  return (
    <ResponsiveContainer className="py-6 flex-1 flex flex-col justify-center">
      <div className="max-w-xl w-full mx-auto space-y-6">
        <PageHeader 
          title="Presensi Geolocation" 
          description="Lakukan pencatatan kehadiran harian menggunakan koordinat lokasi GPS." 
        />

        {user && (user.role === "admin" || user.role === "administrator") && (
          <InfoBanner 
            variant="info" 
            title="Anda login sebagai Administrator." 
            description="Akses penuh rekap kehadiran dan pencatatan manual."
            action={
              <Link 
                href="/presence/recap"
                className="inline-block px-4 py-2 text-xs font-bold rounded-[12px] border border-emerald-600/30 text-[#468432] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition select-none active:scale-95 cursor-pointer shadow-xs"
              >
                Buka Dashboard Rekap & Input Manual
              </Link>
            }
          />
        )}

        {/* Dashboard Card */}
        <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-6 sm:p-8 shadow-xl text-center relative overflow-hidden">
          {/* Live digital clock */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-[#468432] dark:text-emerald-450 tracking-wider uppercase mb-1">
              WAKTU SEKARANG
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
              {time || "00:00:00"}
            </h2>
            <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1.5 font-medium">
              {dateStr}
            </p>
          </div>

          <div className="h-px bg-zinc-150 dark:bg-zinc-800 w-full my-6"></div>

          {/* Messages Alert */}
          {error && (
            <div className="mb-6">
              <InfoBanner variant="error" description={error} />
            </div>
          )}

          {success && (
            <div className="mb-6">
              <InfoBanner 
                variant="success" 
                description={attendanceDetails 
                  ? `${success} Waktu masuk: ${attendanceDetails.time_in} WIB • Jarak: ${attendanceDetails.distance_meters}m dari sekolah` 
                  : success} 
              />
            </div>
          )}

          {/* Action Trigger Button */}
          <div className="flex justify-center my-8">
            <button
              onClick={handleCheckIn}
              disabled={isLocating || isSubmitting || alreadyCheckedIn}
              className={`w-44 h-44 rounded-full flex flex-col items-center justify-center gap-3 transition-all duration-300 shadow-lg relative outline-none select-none active:scale-95 cursor-pointer ${
                alreadyCheckedIn
                  ? "bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-400 cursor-not-allowed shadow-none"
                  : isLocating || isSubmitting
                  ? "bg-emerald-500/10 border-2 border-emerald-500/30 text-[#468432] dark:text-emerald-450 cursor-wait shadow-none animate-pulse"
                  : "bg-[#468432] hover:bg-[#3A6F2B] text-white hover:shadow-[#468432]/20"
              }`}
            >
              {isLocating ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-[#468432] dark:text-emerald-400" />
                  <span className="text-[11px] font-bold tracking-tight">Mencari GPS...</span>
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-[#468432] dark:text-emerald-450" />
                  <span className="text-[11px] font-bold tracking-tight">Menyimpan...</span>
                </>
              ) : alreadyCheckedIn ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-zinc-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider leading-none">Sudah Hadir</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-12 h-12" />
                  <span className="text-xs font-bold uppercase tracking-wider leading-none">Hadir Sekarang</span>
                </>
              )}
            </button>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <p>Pastikan Anda berada dalam radius 150 meter dari wilayah sekolah.</p>
            <p className="mt-1">Role Anda: <span className="font-bold text-zinc-700 dark:text-zinc-300 capitalize">{user?.role}</span></p>
          </div>
        </div>

        {/* Riwayat Presensi Bulan Ini Card */}
        <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-150 dark:border-zinc-800">
            <History className="w-5 h-5 text-[#468432] dark:text-emerald-450" />
            <h3 className="text-md font-bold text-zinc-900 dark:text-zinc-100">
              Riwayat Presensi Bulan Ini
            </h3>
          </div>

          {historyLoading ? (
            <div className="py-8 flex justify-center items-center gap-2 text-zinc-550 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memuat kalender...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Calendar Container */}
              <div className="flex justify-center items-center p-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-[24px] border border-zinc-200/60 dark:border-zinc-800 w-full overflow-hidden">
                <Calendar
                  mode="single"
                  defaultMonth={new Date()}
                  disableNavigation={true}
                  className="w-full flex justify-center"
                  modifiers={{
                    hadir: isHadir,
                    izinSakit: isIzinSakit,
                    alpa: isAlpa,
                    todayPending: isTodayPending,
                  }}
                  modifiersClassNames={{
                    hadir: "!bg-emerald-500 !text-white hover:!bg-[#468432] font-bold rounded-md",
                    izinSakit: "!bg-blue-500 !text-white hover:!bg-blue-600 font-bold rounded-md",
                    alpa: "!bg-rose-500 !text-white hover:!bg-rose-600 font-bold rounded-md",
                    todayPending: "!bg-amber-400 !text-zinc-900 hover:!bg-amber-500 font-bold rounded-md animate-pulse",
                  }}
                />
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-2.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 border-t border-zinc-150 dark:border-zinc-800 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-emerald-500 rounded-md"></div>
                  <span>Hadir (GPS)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-blue-500 rounded-md"></div>
                  <span>Izin/Sakit/Dinas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-rose-500 rounded-md"></div>
                  <span>Alpa / Belum Absen</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-amber-400 rounded-md animate-pulse"></div>
                  <span>Hari Ini Belum Absen</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ResponsiveContainer>
  );
}

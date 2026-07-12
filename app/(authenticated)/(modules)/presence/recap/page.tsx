"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/api/client";
import { humanizeError } from "@/lib/utils/ui-error";
import { PageHeader, ResponsiveContainer, ForbiddenState } from "@/components/ui-states";
import { notify } from "@/lib/notify";
import { InfoBanner } from "@/components/ui/info-banner";
import { DatePicker } from "@/components/ui/date-picker";
import { UX_COPY } from "@/lib/ux-copy";
import * as Dialog from "@radix-ui/react-dialog";
import { Calendar, Clock, Download, Plus, AlertTriangle, User, MapPin, X, Loader2, ListFilter, ClipboardList } from "lucide-react";

interface AttendanceRecord {
  id: string;
  teacher_id: string;
  teacher_name: string;
  date: string;
  time_in: string;
  lat: string | number;
  lng: string | number;
  distance_meters: string | number;
  status: string;
}

interface TeacherProfile {
  id: string;
  user_id: string;
  full_name: string;
}

export default function PresenceRecapPage() {
  const { token, user } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<"daily" | "monthly">("daily");

  // Local date helper
  const getTodayStr = () => {
    try {
      return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
    } catch (e) {
      return new Date().toISOString().split("T")[0];
    }
  };

  // Daily Audit state
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [rosterData, setRosterData] = useState<AttendanceRecord[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  // Monthly Log state
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Global Teachers list for dropdowns
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);

  // Manual input modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTeacherId, setModalTeacherId] = useState("");
  const [modalDate, setModalDate] = useState("");
  const [modalStatus, setModalStatus] = useState("Sakit");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  
  // Custom Toast state removed — using notify service from lib/notify.ts

  // Load Daily Roster
  const loadDailyRoster = useCallback(async () => {
    if (!token) return;
    setRosterLoading(true);
    setRosterError(null);
    try {
      const data = await apiRequest<AttendanceRecord[]>(
        "get_daily_attendance_roster",
        { date: selectedDate },
        token
      );
      setRosterData(data || []);
    } catch (err) {
      console.error("[QA LOG]", err);
      setRosterError(humanizeError(err));
    } finally {
      setRosterLoading(false);
    }
  }, [token, selectedDate]);

  // Load Monthly History
  const loadAttendanceHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<AttendanceRecord[]>(
        "get_attendance_history",
        { month: selectedMonth, year: selectedYear },
        token
      );
      setAttendanceData(data || []);
    } catch (err) {
      console.error("[QA LOG]", err);
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [token, selectedMonth, selectedYear]);

  // Load Teachers list
  const loadTeachers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<TeacherProfile[]>("list_teacher_profiles", {}, token);
      setTeachers(data || []);
      if (data && data.length > 0) {
        setModalTeacherId(data[0].user_id);
      }
    } catch (err) {
      console.error("[QA LOG]", err);
    }
  }, [token]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    if (activeTab === "daily") {
      loadDailyRoster();
    } else {
      loadAttendanceHistory();
    }
  }, [activeTab, loadDailyRoster, loadAttendanceHistory]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setModalSubmitting(true);
    setModalError(null);

    try {
      await apiRequest(
        "record_manual_attendance",
        {
          target_teacher_id: modalTeacherId,
          date: modalDate,
          status: modalStatus,
        },
        token
      );
      notify.success("Presensi manual berhasil dicatat.");
      setIsModalOpen(false);
      // Reset Modal input date only
      setModalDate("");
      
      // Refresh current active view
      if (activeTab === "daily") {
        await loadDailyRoster();
      } else {
        await loadAttendanceHistory();
      }
    } catch (err) {
      console.error("[QA LOG]", err);
      setModalError(humanizeError(err));
    } finally {
      setModalSubmitting(false);
    }
  };

  const openManualModalForTeacher = (teacherId: string, date: string) => {
    try {
      setModalTeacherId(teacherId);
      setModalDate(date);
      setModalStatus("Sakit");
      setModalError(null);
      setIsModalOpen(true);
    } catch (err) {
      console.error("[QA LOG]", err);
    }
  };

  const handleExportCSV = () => {
    try {
      if (attendanceData.length === 0) {
        notify.error("Belum ada data presensi pada periode ini untuk diunduh.");
        return;
      }

      const headers = ["Nama Guru", "Tanggal", "Jam Masuk", "Status", "Jarak (meter)"];
      const rows = attendanceData.map((row) => [
        row.teacher_name,
        row.date,
        row.time_in === "-" ? "Manual" : row.time_in,
        row.status,
        row.distance_meters !== "" ? row.distance_meters : "-",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `rekap_presensi_${selectedYear}_${selectedMonth}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify.success(UX_COPY.dataExchange.exportSuccess);
    } catch (err) {
      console.error("[QA LOG]", err);
      notify.error(UX_COPY.dataExchange.exportFailed);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "hadir") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
          Hadir
        </span>
      );
    }
    if (s === "sakit") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
          Sakit
        </span>
      );
    }
    if (s === "izin") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-855 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30">
          Izin
        </span>
      );
    }
    if (s === "dinas") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-900/30">
          Dinas
        </span>
      );
    }
    if (s === "belum hadir") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/30">
          Belum Hadir
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-850 dark:text-zinc-300">
        {status}
      </span>
    );
  };

  if (!user || (user.role !== "admin" && user.role !== "administrator")) {
    return (
      <ForbiddenState message="Menu rekapitulasi presensi ini hanya dapat diakses oleh Administrator/Admin sekolah." />
    );
  }

  const months = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" }
  ];

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  return (
    <ResponsiveContainer className="space-y-6">

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Rekapitulasi Presensi"
          description="Pantau kehadiran guru dan kelola pencatatan manual."
        />
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {activeTab === "monthly" && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-350 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all select-none active:scale-95 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          
          <button
            onClick={() => {
              setModalDate(getTodayStr());
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-[12px] bg-[#468432] text-white hover:bg-[#3A6F2B] transition-all select-none active:scale-95 cursor-pointer shadow-sm shadow-[#468432]/10"
          >
            <Plus className="w-4 h-4" />
            Input Manual
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("daily")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "daily"
              ? "border-emerald-600 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Audit Harian
        </button>
        <button
          onClick={() => setActiveTab("monthly")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "monthly"
              ? "border-emerald-600 text-[#468432] dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          <ListFilter className="w-4 h-4" />
          Log Bulanan
        </button>
      </div>

      {/* Audit Harian View */}
      {activeTab === "daily" && (
        <div className="space-y-6">
          {/* Daily Filter */}
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5 shadow-md flex flex-wrap gap-4 items-center">
            <div className="flex flex-col gap-1.5 min-w-[200px]">
              <label className="text-[10px] font-bold text-zinc-550 dark:text-zinc-400 tracking-wider uppercase">Pilih Tanggal Audit</label>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="Pilih tanggal..."
              />
            </div>
          </div>

          {/* Daily Table */}
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-xl overflow-hidden">
            {rosterLoading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#468432]" />
                <span className="text-zinc-500 text-xs font-medium">Memuat data harian...</span>
              </div>
            ) : rosterError ? (
              <div className="p-12 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{rosterError}</p>
                <button
                  onClick={loadDailyRoster}
                  className="px-4 py-2 text-xs font-bold text-[#468432] hover:text-emerald-700 transition"
                >
                  Coba Lagi
                </button>
              </div>
            ) : rosterData.length === 0 ? (
              <div className="py-16 text-center text-zinc-550 dark:text-zinc-400 text-xs font-medium">
                Tidak ada data roster guru.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950 text-zinc-550 dark:text-zinc-400 border-b border-zinc-150 dark:border-zinc-800">
                      <th className="p-4 font-semibold uppercase tracking-wider">Nama Guru</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Jam Masuk</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Jarak</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Status</th>
                      <th className="p-4 font-semibold uppercase tracking-wider text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                    {rosterData.map((item, idx) => (
                      <tr key={item.teacher_id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-zinc-700 dark:text-zinc-300 transition-colors">
                        <td className="p-4 font-medium flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-750 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                            {item.teacher_name.charAt(0).toUpperCase()}
                          </div>
                          <span className={item.status === "Belum Hadir" ? "text-zinc-400 dark:text-zinc-500 font-normal" : ""}>
                            {item.teacher_name}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`flex items-center gap-1.5 font-mono text-[11px] ${item.status === "Belum Hadir" ? "text-zinc-400 dark:text-zinc-600" : ""}`}>
                            <Clock className="w-3.5 h-3.5 text-zinc-405 dark:text-zinc-500" />
                            {item.time_in === "-" ? "Belum Masuk" : `${item.time_in} WIB`}
                          </span>
                        </td>
                        <td className="p-4">
                          {item.distance_meters !== "" ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-zinc-405 dark:text-zinc-500" />
                              {item.distance_meters} m
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => openManualModalForTeacher(item.teacher_id, selectedDate)}
                            className="px-3 py-1.5 rounded-lg border border-emerald-600/30 text-emerald-650 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-[10px] font-bold transition cursor-pointer select-none active:scale-95"
                          >
                            Ubah Status
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Bulanan View */}
      {activeTab === "monthly" && (
        <div className="space-y-6">
          {/* Monthly Filter */}
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-5 shadow-md flex flex-wrap gap-4 items-center">
            <div className="flex flex-col gap-1.5 min-w-[150px]">
              <label className="text-[10px] font-bold text-zinc-550 dark:text-zinc-400 tracking-wider uppercase">Bulan</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-[12px] px-3 py-2 text-xs focus:ring-2 focus:ring-[#468432] focus:outline-none cursor-pointer"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-[120px]">
              <label className="text-[10px] font-bold text-zinc-550 dark:text-zinc-400 tracking-wider uppercase">Tahun</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-[12px] px-3 py-2 text-xs focus:ring-2 focus:ring-[#468432] focus:outline-none cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Monthly Data Table */}
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-xl overflow-hidden">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#468432]" />
                <span className="text-zinc-500 text-xs font-medium">Memuat log presensi...</span>
              </div>
            ) : error ? (
              <div className="p-12 text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{error}</p>
                <button
                  onClick={loadAttendanceHistory}
                  className="px-4 py-2 text-xs font-bold text-[#468432] hover:text-emerald-700 transition"
                >
                  Coba Lagi
                </button>
              </div>
            ) : attendanceData.length === 0 ? (
              <div className="py-16 text-center text-zinc-550 dark:text-zinc-400 text-xs font-medium">
                Tidak ada data presensi untuk periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950 text-zinc-550 dark:text-zinc-400 border-b border-zinc-150 dark:border-zinc-800">
                      <th className="p-4 font-semibold uppercase tracking-wider">Nama Guru</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Tanggal</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Jam Masuk</th>
                      <th className="p-4 font-semibold uppercase tracking-wider">Jarak</th>
                      <th className="p-4 font-semibold uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                    {attendanceData.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-zinc-700 dark:text-zinc-300 transition-colors">
                        <td className="p-4 font-medium flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-750 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                            {item.teacher_name.charAt(0).toUpperCase()}
                          </div>
                          <span>{item.teacher_name}</span>
                        </td>
                        <td className="p-4">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-zinc-405 dark:text-zinc-500" />
                            {item.date}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-zinc-405 dark:text-zinc-500" />
                            {item.time_in === "-" ? "Presensi Manual" : `${item.time_in} WIB`}
                          </span>
                        </td>
                        <td className="p-4">
                          {item.distance_meters !== "" ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-zinc-405 dark:text-zinc-500" />
                              {item.distance_meters} m
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {getStatusBadge(item.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Input Manual — menggunakan Radix Dialog untuk Esc key + focus trap */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[24px] shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-150 dark:border-zinc-800">
              <Dialog.Title className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Pencatatan Presensi Manual</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  aria-label="Tutup dialog"
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleManualSubmit} className="p-5 space-y-4">
              {modalError && (
                <InfoBanner variant="error" description={modalError} />
              )}

              {/* Select Teacher */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-550 dark:text-zinc-400 tracking-wider uppercase">Pilih Guru</label>
                <select
                  required
                  value={modalTeacherId}
                  onChange={(e) => setModalTeacherId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-[12px] px-3 py-2 text-xs focus:ring-2 focus:ring-[#468432] focus:outline-none cursor-pointer"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.user_id}>{t.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Date Picker */}
              <div className="flex flex-col gap-1.5">
                <DatePicker
                  label="Tanggal"
                  value={modalDate}
                  onChange={setModalDate}
                  required
                  placeholder="Pilih tanggal presensi..."
                />
              </div>

              {/* Select Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-550 dark:text-zinc-400 tracking-wider uppercase">Status Presensi</label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-[12px] px-3 py-2 text-xs focus:ring-2 focus:ring-[#468432] focus:outline-none cursor-pointer"
                >
                  <option value="Sakit">Sakit</option>
                  <option value="Izin">Izin</option>
                  <option value="Dinas">Dinas</option>
                  <option value="Hadir">Hadir</option>
                </select>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-150 dark:border-zinc-800">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-[12px] text-xs font-bold text-zinc-700 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    Batal
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-xs font-bold bg-[#468432] hover:bg-[#3A6F2B] text-white transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {modalSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Record"
                  )}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ResponsiveContainer>
  );
}

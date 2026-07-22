"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { apiRequest } from "@/lib/api/client";
import { PageHeader, ResponsiveContainer, LoadingState, ForbiddenState } from "@/components/ui-states";
import { listSppPaymentsApi, verifySppPaymentApi, verifyBulkSppPaymentsApi, SppPayment, revertSppPaymentApi, getClassSppArrearsApi, StudentArrearsSummary } from "@/lib/api/finance";
import { humanizeError } from "@/lib/utils/ui-error";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";
import { InfoBanner } from "@/components/ui/info-banner";
import { UX_COPY } from "@/lib/ux-copy";

interface ClassItem {
  id: string;
  name: string;
  code: string;
  status: string;
}

export default function FinancePage() {
  const { token, user } = useAuth();
  useSettings();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  
  // Current calendar month and year based on local time for default
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  const [payments, setPayments] = useState<SppPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arrears View States
  const [activeTab, setActiveTab] = useState<"monthly" | "arrears">("monthly");
  const [arrearsList, setArrearsList] = useState<StudentArrearsSummary[]>([]);
  const [arrearsLoading, setArrearsLoading] = useState(false);
  const [arrearsError, setArrearsError] = useState<string | null>(null);

  // Fetch arrears list
  const loadArrears = useCallback(async () => {
    if (!token || !selectedClassId) return;
    setArrearsLoading(true);
    setArrearsError(null);
    try {
      const data = await getClassSppArrearsApi(token, selectedClassId);
      setArrearsList(data);
    } catch (err: unknown) {
      console.error(err);
      setArrearsError(humanizeError(err));
    } finally {
      setArrearsLoading(false);
    }
  }, [token, selectedClassId]);

  // Load arrears list
  useEffect(() => {
    if (activeTab === "arrears") {
      loadArrears();
    }
  }, [activeTab, loadArrears]);

  const handleOpenVerifyModalFromArrears = (student: StudentArrearsSummary) => {
    if (student.unpaid_months.length === 0) return;
    const earliest = student.unpaid_months[0];
    const virtualPayment: SppPayment = {
      id: earliest.id,
      student_id: student.student_id,
      student_name: student.student_name,
      student_nisn: student.student_nisn,
      academic_year_id: "",
      month: earliest.payment_month,
      year: earliest.payment_year,
      amount_due: earliest.amount_due,
      amount_paid: earliest.amount_paid,
      payment_status: earliest.amount_paid > 0 ? "partial" : "unpaid",
      paid_at: "",
      payment_method: "",
      verified_by: "",
      notes: "",
      created_at: "",
      updated_at: ""
    };
    handleOpenVerifyModal(virtualPayment);
  };

  // Modal State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SppPayment | null>(null);
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [notes, setNotes] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [advanceMonths, setAdvanceMonths] = useState(1);

  // Bulk Selection States
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showBulkVerifyModal, setShowBulkVerifyModal] = useState(false);
  const [bulkAmountPaid, setBulkAmountPaid] = useState("");
  const [bulkPaymentMethod, setBulkPaymentMethod] = useState("transfer");
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkSubmitLoading, setBulkSubmitLoading] = useState(false);
  const [bulkSubmitError, setBulkSubmitError] = useState<string | null>(null);
  const [bulkAdvanceMonths, setBulkAdvanceMonths] = useState(1);

  // Revert Modal States
  const [revertPayment, setRevertPayment] = useState<SppPayment | null>(null);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertLoading, setRevertLoading] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  // Months list helper
  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" }
  ];

  // Years helper
  const years = [selectedYear - 1, selectedYear, selectedYear + 1];

  // Load class list
  useEffect(() => {
    if (!token) return;
    apiRequest<ClassItem[]>("list_classes", {}, token)
      .then((data) => {
        const activeClasses = data.filter((c) => c.status === "active");
        setClasses(activeClasses);
        if (activeClasses.length > 0) {
          setSelectedClassId(activeClasses[0].id);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat kelas", err);
      });
  }, [token]);

  // Fetch payments list
  const loadPayments = useCallback(async () => {
    if (!token || !selectedClassId || !selectedMonth || !selectedYear) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listSppPaymentsApi(token, selectedClassId, selectedMonth, selectedYear);
      setPayments(data);
    } catch (err: unknown) {
      console.error(err);
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [token, selectedClassId, selectedMonth, selectedYear]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPayments();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPayments]);

  const handleOpenVerifyModal = (payment: SppPayment) => {
    setSelectedPayment(payment);
    setAmountPaidInput(String(payment.amount_due - payment.amount_paid));
    setPaymentMethod("transfer");
    setNotes("");
    setSubmitError(null);
    setAdvanceMonths(1);
    setShowVerifyModal(true);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPayment) return;

    const amountNum = parseFloat(amountPaidInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      setSubmitError(UX_COPY.finance.invalidAmount);
      notify.error(UX_COPY.finance.invalidAmount);
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);
    try {
      await verifySppPaymentApi(token, selectedPayment.student_id, amountNum, paymentMethod, notes, advanceMonths);
      notify.success(UX_COPY.finance.verifySuccess);
      setShowVerifyModal(false);
      if (activeTab === "monthly") {
        loadPayments();
      } else {
        loadArrears();
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = humanizeError(err);
      setSubmitError(errMsg);
      notify.error(errMsg);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Treat both 'paid' (new) and 'verified' (legacy) as fully settled
  const isPaidStatus = (status: string) => status === "paid" || status === "verified";

  const unpaidPayments = payments.filter((p) => !isPaidStatus(p.payment_status));
  const isAllSelected = unpaidPayments.length > 0 && selectedStudentIds.length === unpaidPayments.length;

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(unpaidPayments.map((p) => p.student_id));
    }
  };

  const handleSelectRowToggle = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleOpenBulkVerifyModal = () => {
    setBulkAmountPaid("");
    setBulkPaymentMethod("transfer");
    setBulkNotes("Verifikasi Massal");
    setBulkSubmitError(null);
    setBulkAdvanceMonths(1);
    setShowBulkVerifyModal(true);
  };

  const handleBulkVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || selectedStudentIds.length === 0) return;

    setBulkSubmitLoading(true);
    setBulkSubmitError(null);
    try {
      const amountNum = parseFloat(bulkAmountPaid) || 0;
      await verifyBulkSppPaymentsApi(token, selectedStudentIds, amountNum, bulkPaymentMethod, bulkNotes, bulkAdvanceMonths);
      notify.success(UX_COPY.finance.bulkVerifySuccess);
      setShowBulkVerifyModal(false);
      setSelectedStudentIds([]);
      if (activeTab === "monthly") {
        loadPayments();
      } else {
        loadArrears();
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = humanizeError(err);
      setBulkSubmitError(errMsg);
      notify.error(errMsg);
    } finally {
      setBulkSubmitLoading(false);
    }
  };

  const handleOpenRevertDialog = (payment: SppPayment) => {
    setRevertPayment(payment);
    setRevertError(null);
    setShowRevertModal(true);
  };

  const handleRevertSubmit = async () => {
    if (!token || !revertPayment) return;
    setRevertLoading(true);
    setRevertError(null);
    try {
      await revertSppPaymentApi(token, revertPayment.id);
      notify.success(UX_COPY.finance.revertSuccess);
      setShowRevertModal(false);
      if (activeTab === "monthly") {
        loadPayments();
      } else {
        loadArrears();
      }
    } catch (err: unknown) {
      console.error(err);
      const errMsg = humanizeError(err);
      setRevertError(errMsg);
      notify.error(errMsg);
    } finally {
      setRevertLoading(false);
    }
  };

  if (!user || (user.role !== "administrator" && user.role !== "admin")) {
    return (
      <ForbiddenState message="Akses Ditolak. Halaman ini hanya boleh diakses oleh Administrator atau Admin Keuangan." />
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
  };

  return (
    <ResponsiveContainer className="space-y-6 flex-1 flex flex-col justify-start">
      <PageHeader
        title="Manajemen SPP Keuangan"
        description="Kelola tagihan dan verifikasi pembayaran bulanan siswa secara manual."
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("monthly")}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === "monthly"
              ? "border-[#468432] text-[#468432]"
              : "border-transparent text-zinc-550 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          Tagihan Bulanan
        </button>
        <button
          onClick={() => setActiveTab("arrears")}
          className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === "arrears"
              ? "border-[#468432] text-[#468432]"
              : "border-transparent text-zinc-550 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          Rekap Tunggakan
        </button>
      </div>

      {/* Filter Section */}
      <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[12px] shadow-sm space-y-4 md:space-y-0 md:flex md:space-x-4 md:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Kelas</label>
          <select
            className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]"
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setSelectedStudentIds([]);
            }}
          >
            {classes.length === 0 && <option value="">Memuat kelas...</option>}
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        {activeTab === "monthly" && (
          <>
            <div className="w-full md:w-48">
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Bulan</label>
              <select
                className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value));
                  setSelectedStudentIds([]);
                }}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-32">
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Tahun</label>
              <select
                className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setSelectedStudentIds([]);
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Bulk Action Banner */}
      {activeTab === "monthly" && selectedStudentIds.length > 0 && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900 rounded-[12px] flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-450">
            {selectedStudentIds.length} siswa dipilih untuk verifikasi pembayaran.
          </div>
          <button
            onClick={handleOpenBulkVerifyModal}
            className="px-4 py-2 rounded-[12px] text-sm font-semibold text-white bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] shadow-sm transition cursor-pointer"
          >
            Verifikasi {selectedStudentIds.length} Siswa Terpilih
          </button>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[12px] overflow-hidden shadow-sm flex-1 flex flex-col justify-start">
        {activeTab === "monthly" ? (
          loading ? (
            <LoadingState message="Memuat tagihan SPP siswa..." />
          ) : error ? (
            <div className="p-4"><InfoBanner variant="error" description={error} /></div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 font-medium">Tidak ada siswa aktif terdaftar di kelas dan periode terpilih.</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                <thead className="bg-zinc-50 dark:bg-[#171717]">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 dark:border-zinc-700 text-[#468432] focus:ring-[#468432] cursor-pointer"
                        checked={isAllSelected}
                        onChange={handleSelectAllToggle}
                        disabled={unpaidPayments.length === 0}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Nama Siswa</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">NISN</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Tagihan</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Terbayar</th>
                    <th className="px-4 py-3 text-center font-semibold text-zinc-600 dark:text-zinc-400">Status</th>
                    <th className="px-4 py-3 text-center font-semibold text-zinc-600 dark:text-zinc-400">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                  {payments.map((p) => {
                    const isSelected = selectedStudentIds.includes(p.student_id);
                    const isPaid = isPaidStatus(p.payment_status);
                    return (
                      <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                        <td className="px-4 py-3 text-center w-12">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300 dark:border-zinc-700 text-[#468432] focus:ring-[#468432] disabled:opacity-40 cursor-pointer"
                            checked={isSelected}
                            onChange={() => handleSelectRowToggle(p.student_id)}
                            disabled={isPaid}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          <div>{p.student_name}</div>
                          <div className="md:hidden text-xs text-zinc-500 mt-0.5">NISN: {p.student_nisn}</div>
                        </td>
                      <td className="hidden md:table-cell px-4 py-3 text-zinc-600 dark:text-zinc-400">{p.student_nisn}</td>
                      <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-100 font-mono">{formatCurrency(p.amount_due)}</td>
                      <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400 font-mono">{formatCurrency(p.amount_paid)}</td>
                      <td className="px-4 py-3 text-center">
                        {isPaidStatus(p.payment_status) ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                            Lunas
                          </span>
                        ) : p.payment_status === "partial" ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
                            Sebagian
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                            Belum Bayar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!isPaidStatus(p.payment_status) ? (
                          <button
                            onClick={() => handleOpenVerifyModal(p)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] transition"
                          >
                            Verifikasi
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenRevertDialog(p)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-650 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 transition flex items-center gap-1 mx-auto cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Batal Lunas
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="block md:hidden p-4 space-y-3">
              {payments.map((p) => {
                const isSelected = selectedStudentIds.includes(p.student_id);
                const isPaid = isPaidStatus(p.payment_status);
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 dark:border-zinc-700 text-brand-emerald-600 focus-visible:ring-brand-emerald-500 disabled:opacity-40 mt-1 cursor-pointer shrink-0"
                          checked={isSelected}
                          onChange={() => handleSelectRowToggle(p.student_id)}
                          disabled={isPaid}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                            {p.student_name}
                          </div>
                          <div className="text-xs text-zinc-550 dark:text-zinc-400 mt-0.5">
                            NISN: {p.student_nisn}
                          </div>
                        </div>
                      </div>
  
                      <div className="shrink-0">
                        {isPaidStatus(p.payment_status) ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-450">
                            Lunas
                          </span>
                        ) : p.payment_status === "partial" ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-450">
                            Sebagian
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-450">
                            Belum Bayar
                          </span>
                        )}
                      </div>
                    </div>
  
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">Tagihan</span>
                        <span className="font-bold font-mono text-zinc-900 dark:text-zinc-150 block mt-0.5">{formatCurrency(p.amount_due)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-wider">Terbayar</span>
                        <span className="font-bold font-mono text-zinc-650 dark:text-zinc-450 block mt-0.5">{formatCurrency(p.amount_paid)}</span>
                      </div>
                    </div>
  
                    <div className="mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50 flex justify-end">
                      {!isPaidStatus(p.payment_status) ? (
                        <button
                          onClick={() => handleOpenVerifyModal(p)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-brand-emerald-600 hover:bg-brand-emerald-700 active:bg-brand-emerald-800 transition cursor-pointer"
                        >
                          Verifikasi
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenRevertDialog(p)}
                          className="px-3 py-1.5 rounded-[12px] text-xs font-semibold text-red-650 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/15 dark:hover:bg-red-950/30 transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Batal Lunas
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
          )
        ) : (
          arrearsLoading ? (
            <LoadingState message="Memuat rekap tunggakan siswa..." />
          ) : arrearsError ? (
            <div className="p-4"><InfoBanner variant="error" description={arrearsError} /></div>
          ) : arrearsList.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 font-medium">Tidak ada siswa dengan tunggakan di kelas ini. Semua lunas!</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Nama Siswa</th>
                      <th className="hidden md:table-cell px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">NISN</th>
                      <th className="px-4 py-3 text-center font-semibold text-zinc-600 dark:text-zinc-400">Jumlah Bulan</th>
                      <th className="px-4 py-3 text-left font-semibold text-zinc-600 dark:text-zinc-400">Rincian Bulan</th>
                      <th className="px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">Total Tunggakan</th>
                      <th className="px-4 py-3 text-center font-semibold text-zinc-600 dark:text-zinc-400">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                    {arrearsList.map((student) => (
                      <tr key={student.student_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {student.student_name}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {student.student_nisn}
                        </td>
                        <td className="px-4 py-3 text-center text-red-600 dark:text-red-400 font-semibold">
                          {student.unpaid_months.length} Bulan
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs max-w-xs truncate">
                          {student.unpaid_months.map(m => `${months[m.payment_month - 1].label} ${m.payment_year}`).join(", ")}
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-bold font-mono">
                          {formatCurrency(student.total_arrears)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenVerifyModalFromArrears(student)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-emerald-600 hover:bg-brand-emerald-700 active:bg-brand-emerald-800 transition"
                          >
                            Bayar Tunggakan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View for Arrears */}
              <div className="block md:hidden p-4 space-y-3">
                {arrearsList.map((student) => (
                  <div
                    key={student.student_id}
                    className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          {student.student_name}
                        </div>
                        <div className="text-xs text-zinc-550 dark:text-zinc-450 mt-0.5">
                          NISN: {student.student_nisn}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                        {student.unpaid_months.length} Bulan
                      </span>
                    </div>

                    <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 p-2 rounded-lg border border-zinc-100 dark:border-zinc-900">
                      <span className="font-bold block text-[10px] uppercase tracking-wider text-zinc-400 mb-1">Rincian:</span>
                      {student.unpaid_months.map(m => `${months[m.payment_month - 1].label} ${m.payment_year}`).join(", ")}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-450 block uppercase tracking-wider">Total Tunggakan</span>
                        <span className="font-bold font-mono text-red-600 dark:text-red-400 text-sm">{formatCurrency(student.total_arrears)}</span>
                      </div>
                      <button
                        onClick={() => handleOpenVerifyModalFromArrears(student)}
                        className="px-3 py-2 rounded-[12px] text-xs font-semibold text-white bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] transition cursor-pointer"
                      >
                        Bayar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>

      {/* Verification Modal Dialog */}
      <Dialog.Root open={showVerifyModal} onOpenChange={setShowVerifyModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-955/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              {selectedPayment && (
                <>
                  <div className="flex items-start justify-between mb-4 shrink-0">
                    <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      Verifikasi Pembayaran SPP
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-[12px] space-y-1 text-xs mb-4">
                    <div className="flex justify-between text-zinc-500">
                      <span>Nama Siswa</span>
                      <span className="font-semibold text-zinc-950 dark:text-zinc-50">{selectedPayment.student_name}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Periode SPP</span>
                      <span className="font-semibold text-zinc-950 dark:text-zinc-50">
                        {months.find((m) => m.value === selectedPayment.month)?.label} {selectedPayment.year}
                      </span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Total Tagihan</span>
                      <span className="font-semibold text-zinc-950 dark:text-zinc-50 font-mono">{formatCurrency(selectedPayment.amount_due)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Sudah Dibayar</span>
                      <span className="font-semibold text-zinc-950 dark:text-zinc-50 font-mono">{formatCurrency(selectedPayment.amount_paid)}</span>
                    </div>
                  </div>

                  <form onSubmit={handleVerifySubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Jumlah Bayar Baru (IDR)</label>
                      <input
                        type="number"
                        required
                        className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432] font-mono"
                        placeholder="Masukkan nominal transfer atau cash"
                        value={amountPaidInput}
                        onChange={(e) => setAmountPaidInput(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Bayar untuk berapa bulan?</label>
                      <select
                        className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]"
                        value={advanceMonths}
                        onChange={(e) => {
                          const monthsCount = parseInt(e.target.value, 10);
                          setAdvanceMonths(monthsCount);
                          const singleRemaining = selectedPayment.amount_due - selectedPayment.amount_paid;
                          if (monthsCount > 1) {
                            setAmountPaidInput(String(singleRemaining + (monthsCount - 1) * selectedPayment.amount_due));
                          } else {
                            setAmountPaidInput(String(singleRemaining));
                          }
                        }}
                      >
                        <option value={1}>1 Bulan (Bulan Ini/Tunggakan Terlama)</option>
                        <option value={2}>2 Bulan (Sekaligus Bayar Depan)</option>
                        <option value={3}>3 Bulan (Rapel 3 Bulan)</option>
                        <option value={6}>6 Bulan (Setengah Semester)</option>
                        <option value={12}>12 Bulan (Satu Tahun Ajaran)</option>
                      </select>
                    </div>

                    <p className="text-[11px] text-zinc-500 mt-1 italic leading-normal">
                      💡 Tip: Pilih jumlah bulan di atas, sistem akan mengotomatiskan pembuatan tagihan masa depan di cloud.
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Metode Pembayaran</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("transfer")}
                          className={`p-2.5 text-sm rounded-lg border font-medium transition cursor-pointer ${
                            paymentMethod === "transfer"
                              ? "border-emerald-600 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20"
                              : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-zinc-650"
                          }`}
                        >
                          Transfer Bank
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className={`p-2.5 text-sm rounded-lg border font-medium transition cursor-pointer ${
                            paymentMethod === "cash"
                              ? "border-emerald-600 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20"
                              : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-zinc-650"
                          }`}
                        >
                          Cash / Tunai
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Catatan</label>
                      <textarea
                        rows={2}
                        className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]"
                        placeholder="Catatan tambahan pembayaran (opsional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    {submitError && (
                      <InfoBanner variant="error" description={submitError} />
                    )}

                    <div className="flex space-x-3 pt-2">
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="flex-1 p-2.5 text-sm font-medium border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:text-zinc-100 transition cursor-pointer"
                        >
                          Batal
                        </button>
                      </Dialog.Close>
                      <button
                        type="submit"
                        disabled={submitLoading}
                        className="flex-1 p-2.5 text-sm font-medium text-white bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] disabled:opacity-50 rounded-lg transition flex items-center justify-center cursor-pointer"
                      >
                        {submitLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          "Konfirmasi Lunas"
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Bulk Verification Modal Dialog */}
      <Dialog.Root open={showBulkVerifyModal && selectedStudentIds.length > 0} onOpenChange={setShowBulkVerifyModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-955/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
            <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6 border border-zinc-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-start justify-between mb-4 shrink-0">
                <Dialog.Title className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Verifikasi Massal SPP
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-[12px] space-y-1 text-xs mb-4">
                <div className="flex justify-between text-zinc-550">
                  <span>Jumlah Terpilih</span>
                  <span className="font-bold text-zinc-950 dark:text-zinc-50">{selectedStudentIds.length} Siswa</span>
                </div>
                <div className="flex justify-between text-zinc-550">
                  <span>Periode SPP</span>
                  <span className="font-bold text-zinc-950 dark:text-zinc-50 font-mono">
                    {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 max-h-24 overflow-y-auto text-[11px] text-zinc-500 space-y-1">
                  <span className="font-semibold block uppercase tracking-wider text-[9px] text-zinc-400">Daftar Penerima:</span>
                  {payments
                    .filter((p) => selectedStudentIds.includes(p.student_id))
                    .map((p) => (
                      <div key={p.student_id} className="flex justify-between">
                        <span className="truncate max-w-[200px]">{p.student_name}</span>
                        <span className="font-mono text-zinc-500">{formatCurrency(p.amount_due - p.amount_paid)}</span>
                      </div>
                    ))}
                </div>
              </div>

              <form onSubmit={handleBulkVerifySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Nominal Pembayaran (Per Siswa)</label>
                  <input
                    type="number"
                    className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432] font-mono"
                    placeholder="Opsional (Kosongkan untuk otomatis melunasi sisa tagihan)"
                    value={bulkAmountPaid}
                    onChange={(e) => setBulkAmountPaid(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Bayar untuk berapa bulan?</label>
                  <select
                    className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]"
                    value={bulkAdvanceMonths}
                    onChange={(e) => setBulkAdvanceMonths(parseInt(e.target.value, 10))}
                  >
                    <option value={1}>1 Bulan (Bulan Ini/Tunggakan Terlama)</option>
                    <option value={2}>2 Bulan (Sekaligus Bayar Depan)</option>
                    <option value={3}>3 Bulan (Rapel 3 Bulan)</option>
                    <option value={6}>6 Bulan (Setengah Semester)</option>
                    <option value={12}>12 Bulan (Satu Tahun Ajaran)</option>
                  </select>
                </div>

                <p className="text-[11px] text-zinc-500 mt-1 italic leading-normal">
                  💡 Tip: Jika nominal dikosongkan (default), sistem di cloud akan otomatis memverifikasi lunas sesuai sisa tagihan terutang masing-masing siswa selama jumlah bulan yang dipilih.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkPaymentMethod("transfer")}
                      className={`p-2.5 text-sm rounded-lg border font-medium transition cursor-pointer ${
                        bulkPaymentMethod === "transfer"
                          ? "border-emerald-600 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20"
                          : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-zinc-650"
                      }`}
                    >
                      Transfer Bank
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkPaymentMethod("cash")}
                      className={`p-2.5 text-sm rounded-lg border font-medium transition cursor-pointer ${
                        bulkPaymentMethod === "cash"
                          ? "border-emerald-600 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20"
                          : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-zinc-650"
                      }`}
                    >
                      Cash / Tunai
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Catatan</label>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#171717] text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]"
                    placeholder="Catatan verifikasi massal"
                    value={bulkNotes}
                    onChange={(e) => setBulkNotes(e.target.value)}
                  />
                </div>

                {bulkSubmitError && (
                  <InfoBanner variant="error" description={bulkSubmitError} />
                )}

                <div className="flex space-x-3 pt-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="flex-1 p-2.5 text-sm font-medium border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:text-zinc-100 transition cursor-pointer"
                    >
                      Batal
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={bulkSubmitLoading}
                    className="flex-1 p-2.5 text-sm font-medium text-white bg-[#468432] hover:bg-[#3A6F2B] active:bg-[#305C23] disabled:opacity-50 rounded-lg transition flex items-center justify-center cursor-pointer"
                  >
                    {bulkSubmitLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      "Konfirmasi Lunas Massal"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={showRevertModal}
        onOpenChange={setShowRevertModal}
        title="Batalkan Verifikasi SPP?"
        description={
          revertPayment
            ? `Apakah Anda yakin ingin membatalkan status pembayaran SPP untuk ${revertPayment.student_name}? Status akan diubah kembali menjadi Belum Bayar.`
            : ""
        }
        confirmLabel="Ya, Batalkan Lunas"
        variant="destructive"
        loading={revertLoading}
        onConfirm={handleRevertSubmit}
      />
    </ResponsiveContainer>
  );
}

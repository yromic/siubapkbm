"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api/client";
import { AuditLog, AuditLogSearchPayload, searchAuditLogs } from "@/lib/api/audit-logs";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, PageHeader, ResponsiveContainer } from "@/components/ui-states";
import { DatePicker } from "@/components/ui/date-picker";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

const EMPTY_FILTERS = { q: "", action: "", entity_type: "", date_from: "", date_to: "" };
const inputClass = "w-full rounded-[12px] border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#468432] dark:border-zinc-700 dark:bg-[#171717]";

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "ERR_FORBIDDEN") return "Anda tidak memiliki izin untuk mengakses halaman ini.";
    if (error.code === "ERR_NOT_FOUND") return "Data tidak ditemukan.";
    if (error.code === "NETWORK_ERROR") return "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
  }
  return "Terjadi kendala saat memuat data.";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SeverityBadge({ value }: { value: AuditLog["severity"] }) {
  const style = value === "critical" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : value === "warning" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{value}</span>;
}

function SafeValue({ value }: { value: AuditLog["old_value"] }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!text) return <span className="text-zinc-400">Tidak ada</span>;
  return <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-[12px] bg-zinc-100 p-3 text-xs dark:bg-zinc-950">{text}</pre>;
}

export default function AuditLogPage() {
  const { token, user } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const load = useCallback(async () => {
    if (!token || user?.role !== "administrator") { setLoading(false); return; }
    setLoading(true); setError(null);
    const payload: AuditLogSearchPayload = { page, page_size: pageSize };
    Object.entries(applied).forEach(([key, value]) => { if (value) payload[key as keyof typeof applied] = value; });
    try { const result = await searchAuditLogs(token, payload); setLogs(result.logs); setTotal(result.total); }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [token, user?.role, page, pageSize, applied]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (!user || user.role !== "administrator") return <ForbiddenState message="Anda tidak memiliki izin untuk mengakses halaman ini." />;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const submit = (event: FormEvent) => { event.preventDefault(); setPage(1); setApplied(filters); };
  const reset = () => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setPage(1); };

  return <ResponsiveContainer className="space-y-6 py-6">
    <PageHeader title="Audit Log" description="Jejak aktivitas sistem yang bersifat read-only dan sudah disanitasi." />

    <details open className="rounded-[20px] border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#171717]/50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Filter log</summary>
      <form onSubmit={submit} className="grid gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-5">
        <input aria-label="Keyword" placeholder="Keyword" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className={inputClass} />
        <input aria-label="Action" placeholder="Action" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className={inputClass} />
        <input aria-label="Entity type" placeholder="Entity type" value={filters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })} className={inputClass} />
        <DatePicker
          value={filters.date_from}
          onChange={(val) => setFilters({ ...filters, date_from: val })}
          placeholder="Tanggal mulai..."
        />
        <DatePicker
          value={filters.date_to}
          onChange={(val) => setFilters({ ...filters, date_to: val })}
          placeholder="Tanggal akhir..."
        />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5"><button type="submit" className="rounded-[12px] bg-[#468432] px-4 py-2.5 text-sm font-semibold text-white">Terapkan</button><button type="button" onClick={reset} className="rounded-[12px] border border-zinc-300 px-4 py-2.5 text-sm font-semibold dark:border-zinc-700">Reset</button></div>
      </form>
    </details>

    {error && <ErrorState message={error} onRetry={() => void load()} />}
    {loading && logs.length === 0 ? <LoadingState message="Memuat audit log..." /> : !error && logs.length === 0 ? <EmptyState title="Tidak ada audit log" description="Tidak ada log yang sesuai dengan filter." /> : <>
      <div className="hidden overflow-x-auto rounded-[20px] border border-zinc-200 dark:border-zinc-800 md:block">
        <table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-[#171717]"><tr>{["Waktu", "Pengguna", "Action", "Entity", "Severity", "Deskripsi", ""].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{logs.map((log) => <tr key={log.id} className="bg-white align-top dark:bg-zinc-950"><td className="whitespace-nowrap px-4 py-3">{formatDate(log.created_at)}</td><td className="px-4 py-3"><div className="font-medium">{log.user_name || "System"}</div><div className="text-xs text-zinc-500">{log.user_role || "-"}</div></td><td className="px-4 py-3 font-mono text-xs">{log.action}</td><td className="px-4 py-3"><div>{log.entity_type}</div><div className="text-xs text-zinc-500">{log.entity_id || "-"}</div></td><td className="px-4 py-3"><SeverityBadge value={log.severity} /></td><td className="max-w-xs px-4 py-3 text-zinc-600 dark:text-zinc-300">{log.description}</td><td className="px-4 py-3"><button onClick={() => setSelected(log)} className="font-semibold text-emerald-700 dark:text-emerald-400">Detail</button></td></tr>)}</tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">{logs.map((log) => <article key={log.id} className="rounded-[20px] border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#171717]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-zinc-500">{formatDate(log.created_at)}</p><h2 className="mt-1 font-semibold">{log.action}</h2></div><SeverityBadge value={log.severity} /></div><p className="mt-3 text-sm">{log.description}</p><div className="mt-3 text-xs text-zinc-500">{log.user_name || "System"} · {log.entity_type} · {log.entity_id || "-"}</div><button onClick={() => setSelected(log)} className="mt-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Lihat detail</button></article>)}</div>

      <div className="flex items-center justify-between gap-3"><p className="text-sm text-zinc-500">{total} log · Halaman {page} dari {totalPages}</p><div className="flex gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-[12px] border border-zinc-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-zinc-700">Sebelumnya</button><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-[12px] border border-zinc-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-zinc-700">Berikutnya</button></div></div>
    </>}

    <Dialog.Root open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
          {selected && (
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl dark:bg-[#171717] sm:rounded-[24px] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-zinc-500">{formatDate(selected.created_at)}</p>
                  <Dialog.Title className="mt-1 text-lg font-bold">{selected.action}</Dialog.Title>
                </div>
                <Dialog.Close asChild>
                  <button aria-label="Tutup detail" className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Pengguna</dt><dd>{selected.user_name || "System"} ({selected.user_role || "-"})</dd></div><div><dt className="text-zinc-500">Entity</dt><dd>{selected.entity_type} / {selected.entity_id || "-"}</dd></div><div><dt className="text-zinc-500">IP address</dt><dd>{selected.ip_address || "-"}</dd></div><div><dt className="text-zinc-500">User agent</dt><dd className="break-all">{selected.user_agent || "-"}</dd></div></dl>
              <p className="mt-5 text-sm">{selected.description}</p><div className="mt-5 space-y-4"><div><h3 className="mb-2 text-sm font-semibold">Old value</h3><SafeValue value={selected.old_value} /></div><div><h3 className="mb-2 text-sm font-semibold">New value</h3><SafeValue value={selected.new_value} /></div></div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </ResponsiveContainer>;
}

/**
 * curriculumBankClient.ts
 * Typed API client helper for fetching and managing Bank TP and Bank CP in SIUBA.
 *
 * Distinguishes clearly between:
 * - Successful response with data: { items, pagination }
 * - Successful response with empty data: { items: [], pagination }
 * - HTTP / Server / Parsing Error: throws structured Error (does not silently swallow into [])
 */

import { BankTPItem, BankCPItem } from "@/lib/utils/curriculumFilterUtils";

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
}

export interface BankTPFetchParams {
  fase?: string;
  class_level?: number | string;
  cp_id?: string;
  kode?: string;
  mata_pelajaran_id?: string;
  mata_pelajaran_name?: string;
  search?: string;
  sumber?: string;
  page?: number;
  limit?: number;
}

export interface BankCPFetchParams {
  fase?: string;
  class_level?: number | string;
  kode?: string;
  mata_pelajaran_id?: string;
  mata_pelajaran_name?: string;
  domain_trisula?: string;
  search?: string;
  status?: string;
  sumber?: string;
  page?: number;
  limit?: number;
}

export interface BankTPFetchResult {
  items: BankTPItem[];
  pagination: PaginationInfo;
}

export interface BankCPFetchResult {
  items: BankCPItem[];
  pagination: PaginationInfo;
}

export interface UpdateTPPayload {
  teks?: string;
  cp_id?: string | null;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  fase?: string;
}

export interface UpdateCPPayload {
  teks?: string;
  kode?: string | null;
  fase?: string;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  domain_trisula?: string | null;
}

/**
 * Fetch Tujuan Pembelajaran (TP) from the shared Bank TP API.
 */
export async function fetchBankTPs(params: BankTPFetchParams = {}): Promise<BankTPFetchResult> {
  const searchParams = new URLSearchParams();

  if (params.fase) searchParams.set("fase", params.fase);
  if (params.class_level !== undefined) searchParams.set("class_level", String(params.class_level));
  if (params.cp_id && params.cp_id !== "ALL") searchParams.set("cp_id", params.cp_id);
  if (params.kode) searchParams.set("kode", params.kode);
  if (params.mata_pelajaran_id) searchParams.set("mata_pelajaran_id", params.mata_pelajaran_id);
  if (params.mata_pelajaran_name && params.mata_pelajaran_name !== "Semua") {
    searchParams.set("mata_pelajaran_name", params.mata_pelajaran_name);
  }
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (params.sumber) searchParams.set("sumber", params.sumber);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));

  const url = `/api/v1/tp-bank${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err: any) {
    throw new Error(`Kendala koneksi saat menghubungi server: ${err?.message || "Network Error"}`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Gagal membaca respons dari server (HTTP ${res.status}).`);
  }

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Gagal memuat Bank TP (HTTP ${res.status}).`);
  }

  const rawItems = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data?.items)
    ? json.data.items
    : Array.isArray(json.data)
    ? json.data
    : null;

  if (rawItems === null) {
    throw new Error("Format respons Bank TP tidak dikenali oleh sistem.");
  }

  const pagination: PaginationInfo = json.data?.pagination || {
    page: params.page || 1,
    limit: params.limit || rawItems.length || 50,
    total: rawItems.length,
  };

  return {
    items: rawItems as BankTPItem[],
    pagination,
  };
}

/**
 * Fetch Capaian Pembelajaran (CP) from the shared Bank CP API.
 */
export async function fetchBankCPs(params: BankCPFetchParams = {}): Promise<BankCPFetchResult> {
  const searchParams = new URLSearchParams();

  if (params.fase) searchParams.set("fase", params.fase);
  if (params.class_level !== undefined) searchParams.set("class_level", String(params.class_level));
  if (params.kode) searchParams.set("kode", params.kode);
  if (params.mata_pelajaran_id) searchParams.set("mata_pelajaran_id", params.mata_pelajaran_id);
  if (params.mata_pelajaran_name && params.mata_pelajaran_name !== "Semua") {
    searchParams.set("mata_pelajaran_name", params.mata_pelajaran_name);
  }
  if (params.domain_trisula) searchParams.set("domain_trisula", params.domain_trisula);
  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (params.status) searchParams.set("status", params.status);
  if (params.sumber) searchParams.set("sumber", params.sumber);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit) searchParams.set("limit", String(params.limit));

  const url = `/api/v1/cp-bank${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err: any) {
    throw new Error(`Kendala koneksi saat menghubungi server: ${err?.message || "Network Error"}`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Gagal membaca respons dari server (HTTP ${res.status}).`);
  }

  if (!res.ok || !json.success) {
    throw new Error(json.message || `Gagal memuat Bank CP (HTTP ${res.status}).`);
  }

  const rawItems = Array.isArray(json.data?.data)
    ? json.data.data
    : Array.isArray(json.data?.items)
    ? json.data.items
    : Array.isArray(json.data)
    ? json.data
    : null;

  if (rawItems === null) {
    throw new Error("Format respons Bank CP tidak dikenali oleh sistem.");
  }

  const pagination: PaginationInfo = json.data?.pagination || {
    page: params.page || 1,
    limit: params.limit || rawItems.length || 50,
    total: rawItems.length,
  };

  return {
    items: rawItems as BankCPItem[],
    pagination,
  };
}

/**
 * Update an existing TP in Bank TP.
 */
export async function updateBankTPClient(id: string, payload: UpdateTPPayload): Promise<BankTPItem> {
  const res = await fetch(`/api/v1/tp-bank/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Gagal memperbarui Tujuan Pembelajaran.");
  }

  return json.data;
}

/**
 * Delete a TP from Bank TP.
 */
export async function deleteBankTPClient(id: string): Promise<void> {
  const res = await fetch(`/api/v1/tp-bank/${id}`, {
    method: "DELETE",
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Gagal menghapus Tujuan Pembelajaran.");
  }
}

/**
 * Update an existing CP in Bank CP.
 */
export async function updateBankCPClient(id: string, payload: UpdateCPPayload): Promise<BankCPItem> {
  const res = await fetch(`/api/v1/cp-bank/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Gagal memperbarui Capaian Pembelajaran.");
  }

  return json.data;
}

/**
 * Delete or deactivate a CP from Bank CP.
 */
export async function deleteBankCPClient(id: string): Promise<{ deleted: boolean; message: string }> {
  const res = await fetch(`/api/v1/cp-bank/${id}`, {
    method: "DELETE",
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Gagal menghapus Capaian Pembelajaran.");
  }

  return json.data || { deleted: true, message: json.message };
}

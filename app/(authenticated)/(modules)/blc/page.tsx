"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UX_COPY } from "@/lib/ux-copy";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PrintRenderer } from "@/components/print/print-renderer";
import { PrintBrowserHint } from "@/components/print/PrintBrowserHint";
import { Loader2, Copy, Search, Printer, BookOpen, Layers, UserCheck, Link2 } from "lucide-react";
import { toast } from "sonner";
import { RPMAttachment } from "@/types/rpmAttachment";
import { fetchRpmAttachments } from "@/lib/api/rpmAttachments";
import { RPMAttachmentPreviewNotice } from "@/components/rpm/RPMAttachmentPreviewNotice";
import { AttachmentLoadStatus, shouldConfirmAttachmentPrint } from "@/lib/utils/attachmentPreview";

interface BLCItem {
  id: string;
  title: string;
  type: 'RPM' | 'KKTP' | 'TRISULA';
  status: 'DRAFT' | 'PUBLISHED' | 'APPROVED' | 'ARCHIVED';
  version: number;
  author_name?: string;
  class_name?: string;
  subject_name?: string;
  forked_from_id?: string | null;
  signed_at?: string | null;      // RPM: timestamp tanda tangan resmi
  blc_shared_at?: string | null;  // RPM: timestamp berbagi ke BLC
  created_at: string;
  content: any;
}

export default function BankModulBLCPage() {
  const [documents, setDocuments] = useState<BLCItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  // BR-BLC-04: Smart filter state — default dari penugasan guru
  const [filterSubjectId, setFilterSubjectId] = useState<string>("");
  const [filterClassId, setFilterClassId] = useState<string>("");
  const [smartFilterLabel, setSmartFilterLabel] = useState<string>("");
  const [activeDoc, setActiveDoc] = useState<BLCItem | null>(null);
  const [activeDocAttachments, setActiveDocAttachments] = useState<RPMAttachment[]>([]);
  const [attachmentLoadStatus, setAttachmentLoadStatus] = useState<AttachmentLoadStatus>('idle');
  const [lineageInfo, setLineageInfo] = useState<Record<string, { title: string; authorName: string }>>({});
  const [view, setView] = useState<'CATALOG' | 'PRINT'>('CATALOG');

  const loadRpmAttachments = useCallback(async (documentId: string): Promise<boolean> => {
    setAttachmentLoadStatus('loading');
    try {
      const attachments = await fetchRpmAttachments(documentId);
      setActiveDocAttachments(attachments);
      setAttachmentLoadStatus('success');
      return true;
    } catch (error) {
      setAttachmentLoadStatus('error');
      console.error("BLC RPM attachment fetch failed", {
        module: "BLC",
        documentId,
        operation: "fetch attachments",
        error,
      });
      return false;
    }
  }, []);

  const handlePrint = useCallback(() => {
    if (
      shouldConfirmAttachmentPrint(attachmentLoadStatus) &&
      !window.confirm("Lampiran gagal dimuat. Cetak dokumen tanpa memastikan lampiran termuat?")
    ) {
      return;
    }
    window.print();
  }, [attachmentLoadStatus]);

  const jumpToAttachments = useCallback(() => {
    document.getElementById('rpm-lampiran')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // BR-BLC-04: Inisialisasi smart filter dari penugasan aktif guru (Fix 3.1)
  useEffect(() => {
    const loadTeacherAssignment = async () => {
      try {
        const res = await fetch("/api/v1/class-teachers?limit=1");
        const json = await res.json();
        const items = json?.data?.items || json?.items || [];
        if (items.length > 0) {
          const first = items[0];
          const subjId = first.subject_id || "";
          const classId = first.class_id || "";
          const label = [first.class_name, first.subject_name].filter(Boolean).join(" · ");
          setFilterSubjectId(subjId);
          setFilterClassId(classId);
          if (label) setSmartFilterLabel(label);
        }
      } catch {
        // Tidak bisa ambil assignment — biarkan guru set manual
      }
    };
    loadTeacherAssignment();
  }, []);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      // BR-BLC-04: Kirim filter ke server, bukan filter di client setelah fetch semua
      const params = new URLSearchParams();
      if (filterSubjectId) params.set("subject_id", filterSubjectId);
      if (filterClassId) params.set("class_id", filterClassId);

      // Zero-approval workflow: RPM, KKTP, TRISULA langsung siap dipakai
      const rpmParams = new URLSearchParams(params);
      rpmParams.set("type", "RPM");
      rpmParams.set("blc_shared", "true");

      const kktpParams = new URLSearchParams(params);
      kktpParams.set("type", "KKTP");

      const trisulaParams = new URLSearchParams(params);
      trisulaParams.set("type", "TRISULA");

      const [resRpm, resKktp, resTrisula] = await Promise.all([
        fetch(`/api/v1/documents?${rpmParams.toString()}`),
        fetch(`/api/v1/documents?${kktpParams.toString()}`),
        fetch(`/api/v1/documents?${trisulaParams.toString()}`),
      ]);
      const [jsonRpm, jsonKktp, jsonTrisula] = await Promise.all([
        resRpm.json(),
        resKktp.json(),
        resTrisula.json(),
      ]);

      const rpmItems = jsonRpm.success ? (jsonRpm.data.items || []) : [];
      const kktpItems = jsonKktp.success ? (jsonKktp.data.items || []) : [];
      const trisulaItems = jsonTrisula.success ? (jsonTrisula.data.items || []) : [];

      const allItems: BLCItem[] = [...rpmItems, ...kktpItems, ...trisulaItems];
      setDocuments(allItems);

      // Fetch lineage info untuk tampilkan "Diadaptasi dari..." (Fix 3.4)
      const forkedIds = allItems
        .filter((d: BLCItem) => d.forked_from_id)
        .map((d: BLCItem) => d.forked_from_id as string);
      if (forkedIds.length > 0) {
        const lineageMap: Record<string, { title: string; authorName: string }> = {};
        await Promise.all(forkedIds.map(async (fid: string) => {
          try {
            const lr = await fetch(`/api/v1/documents/${fid}`);
            const lj = await lr.json();
            if (lj.success && lj.data) {
              lineageMap[fid] = { title: lj.data.title, authorName: lj.data.author_name || "Guru" };
            }
          } catch { /* skip */ }
        }));
        setLineageInfo(lineageMap);
      }

    } catch {
      toast.error("Terjadi kendala saat memuat katalog BLC.");
    } finally {
      setLoading(false);
    }
  }, [filterSubjectId, filterClassId]);


  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);


  const handleClone = async (doc: BLCItem) => {
    setCloningId(doc.id);
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/clone`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Modul "${doc.title}" berhasil diduplikasi ke draf Anda.`);
      } else {
        toast.error(json.message || "Gagal menduplikasi modul.");
      }
    } catch {
      toast.error("Terjadi kendala saat menduplikasi modul.");
    } finally {
      setCloningId(null);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const matchSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.author_name && doc.author_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchType = filterType ? doc.type === filterType : true;
    return matchSearch && matchType;
  });

  if (view === 'PRINT' && activeDoc) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto p-4 print:p-0">
        <div className="flex justify-between items-center print:hidden border-b pb-4">
          <Button variant="secondary" onClick={() => setView('CATALOG')} className="min-h-[44px]">
            &larr; Kembali ke Katalog
          </Button>
          <Button onClick={handlePrint} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700">
            <Printer className="w-4 h-4 mr-2" /> Cetak Dokumen
          </Button>
        </div>

        <PrintBrowserHint />

        {String(activeDoc.type || '').toUpperCase() === 'RPM' && (
          <RPMAttachmentPreviewNotice
            count={activeDocAttachments.length}
            status={attachmentLoadStatus}
            onJump={jumpToAttachments}
            onRetry={() => void loadRpmAttachments(activeDoc.id)}
          />
        )}

        <PrintRenderer document={activeDoc} attachments={activeDocAttachments}>
          <div className="space-y-4 text-xs">
            {activeDoc.forked_from_id && (
              <div className="p-2 border rounded bg-slate-50 text-slate-700 italic text-xs">
                {lineageInfo[activeDoc.forked_from_id]
                  ? `Diadaptasi dari: "${lineageInfo[activeDoc.forked_from_id].title}" — ${lineageInfo[activeDoc.forked_from_id].authorName}`
                  : `Diadaptasi dari dokumen lain (ID: ${activeDoc.forked_from_id})`
                }
              </div>
            )}
            <div className="border p-4 rounded bg-gray-50/50">
              <h3 className="font-bold text-sm text-gray-700 uppercase mb-2">Pratinjau Isi Dokumen BLC</h3>
              <pre className="whitespace-pre-wrap font-sans text-xs">{JSON.stringify(activeDoc.content, null, 2)}</pre>
            </div>
          </div>
        </PrintRenderer>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bank Modul BLC</h1>
          <p className="text-xs text-gray-500">
            Perpustakaan & Etalase Modul Pembelajaran Terpadu SIUBA.
          </p>
        </div>
      </div>

      {/* Smart filter indicator (BR-BLC-04) */}
      {smartFilterLabel && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Layers className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Filter otomatis berdasarkan penugasan Anda: <strong>{smartFilterLabel}</strong></span>
          <button
            onClick={() => { setFilterSubjectId(""); setFilterClassId(""); setSmartFilterLabel(""); }}
            className="ml-auto text-[10px] text-gray-400 hover:text-gray-700 underline"
          >
            Tampilkan Semua
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Input
            placeholder="Cari berdasarkan judul modul atau nama guru..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-[44px] pl-10"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
        </div>

        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          options={[
            { value: "", label: "Semua Tipe Dokumen" },
            { value: "RPM", label: "RPM (Rencana Pemelajaran)" },
            { value: "KKTP", label: "Assessment KKTP" },
            { value: "TRISULA", label: "Assessment Trisula" },
          ]}
          className="min-h-[44px]"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="text-center p-8">
          <div className="space-y-3 pt-6 p-5">
            <BookOpen className="w-12 h-12 mx-auto text-gray-400" />
            <h3 className="font-semibold text-sm">Tidak Ada Modul Ditemukan</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Belum ada modul yang disahkan atau dipublikasi sesuai filter pencarian Anda.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const statusLabel = UX_COPY.documents.statusLabel[doc.status] || doc.status;
            const badgeColor = UX_COPY.documents.statusBadgeColor[doc.status] || "bg-gray-100 text-gray-700";

            return (
              <Card key={doc.id} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200">
                      Siap Dipakai
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {doc.type}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold line-clamp-2">{doc.title}</h3>
                  
                  <div className="text-xs text-gray-600 space-y-1 mt-3">
                    <p className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                      <span>Penyusun: {doc.author_name || "-"}</span>
                    </p>
                  {doc.class_name && doc.subject_name && (
                    <p><span className="font-semibold">Kelas / Mapel:</span> {doc.class_name} · {doc.subject_name}</p>
                  )}
                  {doc.forked_from_id && lineageInfo[doc.forked_from_id] && (
                    <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Diadaptasi dari: &ldquo;{lineageInfo[doc.forked_from_id].title}&rdquo; — {lineageInfo[doc.forked_from_id].authorName}</span>
                    </p>
                  )}
                  {doc.forked_from_id && !lineageInfo[doc.forked_from_id] && (
                    <p className="text-[10px] text-gray-400 italic">
                      Diadaptasi dari modul lain
                    </p>
                  )}
                  </div>
                </div>

                <CardFooter className="border-t pt-3 flex justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setActiveDoc(doc);
                      setActiveDocAttachments([]);
                      setAttachmentLoadStatus('idle');
                      if (String(doc.type || '').toUpperCase() === 'RPM' && doc.id) {
                        await loadRpmAttachments(doc.id);
                      } else {
                        setActiveDocAttachments([]);
                        setAttachmentLoadStatus('success');
                      }
                      setView('PRINT');
                    }}
                    className="min-h-[36px] text-xs"
                  >
                    Pratinjau
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleClone(doc)}
                    disabled={cloningId === doc.id}
                    className="min-h-[36px] text-xs bg-emerald-600 hover:bg-emerald-700"
                  >
                    {cloningId === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 mr-1" />
                    )}
                    {UX_COPY.documents.actions.clone}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

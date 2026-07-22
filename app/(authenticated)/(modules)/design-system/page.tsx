"use client";

/**
 * Design System Showcase — Engineering validation page.
 *
 * PURPOSE: Internal engineering validation only.
 * NOT exposed to end users. Accessible only to administrators.
 *
 * Validates Sprint 2 Foundation, Sprint 3 Navigation/Forms/Interactions, Sprint 4 Data Display, & Sprint 5 Business Components:
 * - StudentIdentityCard, AcademicScoreCard
 * - KPICard, DataTable, CardAccordionList, Drawer
 * - Button, Card, Badge, Typography, Divider, Avatar, Surface, PageFramework
 * - Tabs, Pagination, SearchBar, FormField, Input, Select, Textarea, ScoreSelector, MilestoneCelebrationModal
 */

import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ForbiddenState, LoadingState, PageHeader } from "@/components/ui-states";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import { Avatar, AvatarGroup } from "@/components/ui/avatar";
import { Surface } from "@/components/ui/surface";
import {
  PageContainer,
  PageContent,
  PageToolbar,
  PageFooterActions,
} from "@/components/ui/page-framework";
import {
  PageTitle,
  KPIValue,
  SectionTitle,
  CardTitle,
  Body,
  Caption,
  Label,
  ColumnLabel,
  NumericDisplay,
  HelperText,
} from "@/components/ui/typography";
import { LifecycleBadge } from "@/components/lifecycle-badge";
import { StatusBadge } from "@/components/status-badge";
import { InfoBanner } from "@/components/ui/info-banner";

// Sprint 3, 4, & 5 Imports
import { Tabs } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { SearchBar } from "@/components/ui/search-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScoreSelector } from "@/components/ui/score-selector";
import { MilestoneCelebrationModal } from "@/components/ui/milestone-celebration-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { KPICard } from "@/components/ui/kpi-card";
import { DataTable, Column } from "@/components/ui/data-table";
import { CardAccordionList } from "@/components/ui/card-accordion-list";
import { Drawer } from "@/components/ui/drawer";
import { StudentIdentityCard } from "@/components/ui/student-identity-card";
import { AcademicScoreCard } from "@/components/ui/academic-score-card";

import {
  Plus,
  Download,
  Trash2,
  Settings,
  Eye,
  Loader2,
  Mail,
  User,
  Sparkles,
  Users,
  TrendingUp,
  GraduationCap,
  Filter,
} from "lucide-react";

interface SampleStudent {
  id: string;
  name: string;
  nisn: string;
  class: string;
  status: string;
}

const SAMPLE_STUDENTS: SampleStudent[] = [
  { id: "1", name: "Ahmad Rizki", nisn: "0012345678", class: "7A", status: "ACTIVE" },
  { id: "2", name: "Siti Fatimah", nisn: "0012345679", class: "7A", status: "ACTIVE" },
  { id: "3", name: "Budi Santoso", nisn: "0012345680", class: "7B", status: "INACTIVE" },
  { id: "4", name: "Dewi Rahayu", nisn: "0012345681", class: "8A", status: "GRADUATED" },
];

function ShowcaseSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ColumnLabel>{title}</ColumnLabel>
        <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
      </div>
      {children}
    </div>
  );
}

export default function DesignSystemShowcase() {
  const { user, loading } = useAuth();
  const [showSticky, setShowSticky] = useState(false);

  // State
  const [activeTabLine, setActiveTabLine] = useState("overview");
  const [activeTabPills, setActiveTabPills] = useState("all");
  const [page, setPage] = useState(1);
  const [searchVal, setSearchVal] = useState("");
  const [inputVal, setInputVal] = useState("Ahmad Rizki");
  const [selectVal, setSelectVal] = useState("active");
  const [textareaVal, setTextareaVal] = useState("Catatan perkembangan siswa semester ini.");
  const [scoreVal, setScoreVal] = useState<number | null>(3);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<"appreciation" | "celebration">("celebration");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set(["1"]));

  const allowed = user?.role === "administrator" || user?.role === "admin";

  if (loading) {
    return <LoadingState message="Memuat halaman..." />;
  }

  if (!user || !allowed) {
    return <ForbiddenState message="Halaman ini hanya dapat diakses oleh administrator sistem." />;
  }

  const columns: Column<SampleStudent>[] = [
    {
      key: "name",
      header: "Nama Siswa",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size="xs" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{row.name}</span>
        </div>
      ),
    },
    {
      key: "nisn",
      header: "NISN",
      cell: (row) => <NumericDisplay>{row.nisn}</NumericDisplay>,
    },
    {
      key: "class",
      header: "Kelas",
      cell: (row) => <Badge variant="brand">{row.class}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <LifecycleBadge status={row.status as any} />,
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      cell: () => (
        <Button variant="ghost" size="sm">
          Detail
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      {/* ── Page Header ── */}
      <PageHeader
        title="Design System Showcase"
        description="Halaman validasi internal komponen fondasi Sprint 2, 3, 4, & 5. Hanya untuk engineering."
        breadcrumbs={[
          { label: "Beranda", href: "/dashboard" },
          { label: "Health Check", href: "/health-check" },
          { label: "Design System" },
        ]}
        statusBadge={<Badge variant="info">Internal</Badge>}
        actions={
          <Button variant="secondary" leftIcon={<Settings className="w-4 h-4" />} size="sm">
            Sprint 5 Active
          </Button>
        }
      />

      <PageContent>
        {/* ── Info Banner ── */}
        <InfoBanner
          variant="info"
          title="Halaman Internal Sprint 5"
          description="Memvalidasi Domain Business Components (Layer 8: StudentIdentityCard, AcademicScoreCard)."
        />

        <PageToolbar>
          <SearchBar value={searchVal} onChange={setSearchVal} placeholder="Cari komponen..." />
          <Button variant="secondary" size="sm" leftIcon={<Filter className="w-3.5 h-3.5" />} onClick={() => setDrawerOpen(true)}>
            Drawer Filter
          </Button>
          <Button variant={showSticky ? "primary" : "ghost"} size="sm" onClick={() => setShowSticky((v) => !v)}>
            {showSticky ? "Sembunyikan Sticky Bar" : "Tampilkan Sticky Bar"}
          </Button>
        </PageToolbar>

        {/* ── SPRINT 5: BUSINESS COMPONENTS (LAYER 8) ── */}
        <ShowcaseSection title="Sprint 5 — Business Components (Layer 8: Educational Domain Architecture)">
          <div className="space-y-4">
            <StudentIdentityCard
              name="Muhammad Amirul Hadi"
              nisn="0012345678"
              nik="3201123456780001"
              classNameLabel="Kelas 7A"
              status="ACTIVE"
              actions={
                <Button variant="secondary" size="sm">
                  Edit Profil
                </Button>
              }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AcademicScoreCard
                subjectName="Pendidikan Agama Islam"
                score={88}
                passingGrade={75}
                predicate="A"
                teacherName="Ust. Abdullah"
              />
              <AcademicScoreCard
                subjectName="Matematika"
                score={68}
                passingGrade={75}
                predicate="C"
                teacherName="Bu Nurul"
              />
              <AcademicScoreCard
                subjectName="Bahasa Indonesia"
                score={null}
                passingGrade={75}
                teacherName="Pak Ahmad"
              />
            </div>
          </div>
        </ShowcaseSection>

        {/* ── SPRINT 4: KPI & STATISTICS SYSTEM ── */}
        <ShowcaseSection title="Sprint 4 — Data Display: KPICard System">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Siswa Aktif"
              value="1.247"
              trend={{ value: "+12%", direction: "up", label: "vs bulan lalu" }}
              icon={<Users className="w-5 h-5 text-emerald-600" />}
            />
            <KPICard
              title="Kehadiran Hari Ini"
              value="98.5%"
              trend={{ value: "+0.5%", direction: "up" }}
              icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            />
            <KPICard
              title="Tunggakan SPP"
              value="14"
              trend={{ value: "-3", direction: "down", label: "penurunan tunggakan" }}
              icon={<GraduationCap className="w-5 h-5 text-amber-600" />}
            />
            <KPICard title="Status Sinkronisasi" value="Normal" subtitle="Terakhir sinkron 5 mnt lalu" />
          </div>
        </ShowcaseSection>

        {/* ── SPRINT 4: RESPONSIVE DATA TABLE & MOBILE CARD ACCORDION ── */}
        <ShowcaseSection title="Sprint 4 — Presentation: DataTable (Desktop) & CardAccordionList (Mobile)">
          <DataTable
            columns={columns}
            data={SAMPLE_STUDENTS}
            keyExtractor={(row) => row.id}
            selectable
            selectedKeys={selectedKeys}
            onSelectRow={(key, checked) => {
              const next = new Set(selectedKeys);
              if (checked) next.add(key);
              else next.delete(key);
              setSelectedKeys(next);
            }}
            onSelectAll={(checked) => {
              if (checked) setSelectedKeys(new Set(SAMPLE_STUDENTS.map((s) => s.id)));
              else setSelectedKeys(new Set());
            }}
          />

          <CardAccordionList
            data={SAMPLE_STUDENTS}
            keyExtractor={(row) => row.id}
            renderHeader={(row) => (
              <div className="flex items-center justify-between gap-2">
                <span>{row.name}</span>
                <LifecycleBadge status={row.status as any} />
              </div>
            )}
            renderSummary={(row) => (
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="brand">{row.class}</Badge>
                <NumericDisplay className="text-xs">NISN: {row.nisn}</NumericDisplay>
              </div>
            )}
            renderDetails={(row) => (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">ID Siswa:</span>
                  <NumericDisplay>{row.id}</NumericDisplay>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500">Status Legacy:</span>
                  <StatusBadge status={row.status} />
                </div>
                <div className="pt-2 flex justify-end">
                  <Button variant="secondary" size="sm">
                    Lihat Profil Full
                  </Button>
                </div>
              </div>
            )}
          />

          <Card padding="none" className="mt-3">
            <Pagination page={page} totalPages={5} totalItems={48} itemLabel="siswa" onPageChange={setPage} />
          </Card>
        </ShowcaseSection>

        {/* ── SPRINT 3: TABS ── */}
        <ShowcaseSection title="Sprint 3 — Navigation: Tabs (Line & Pills)">
          <Card padding="md" className="space-y-6">
            <div>
              <Caption className="block mb-2">Tabs Variant: Line (Default)</Caption>
              <Tabs
                items={[
                  { id: "overview", label: "Ringkasan", badge: 4 },
                  { id: "students", label: "Data Siswa" },
                  { id: "finance", label: "Keuangan" },
                  { id: "disabled", label: "Nonaktif", disabled: true },
                ]}
                activeId={activeTabLine}
                onChange={setActiveTabLine}
              />
            </div>

            <div>
              <Caption className="block mb-2">Tabs Variant: Pills</Caption>
              <Tabs
                variant="pills"
                items={[
                  { id: "all", label: "Semua", badge: 12 },
                  { id: "active", label: "Aktif" },
                  { id: "archived", label: "Arsip" },
                ]}
                activeId={activeTabPills}
                onChange={setActiveTabPills}
              />
            </div>
          </Card>
        </ShowcaseSection>

        {/* ── SPRINT 3: FORM CONTROLS ── */}
        <ShowcaseSection title="Sprint 3 — Form Controls (Input, Select, Textarea, FormField)">
          <Card padding="md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Nama Lengkap" required hint="Sesuai akta kelahiran">
                <Input value={inputVal} onChange={(e) => setInputVal(e.target.value)} leftIcon={<User className="w-4 h-4" />} />
              </FormField>

              <FormField label="Alamat Email" required error={inputVal ? undefined : "Email wajib diisi"}>
                <Input type="email" placeholder="contoh@sekolah.id" leftIcon={<Mail className="w-4 h-4" />} error={!inputVal} />
              </FormField>

              <FormField label="Status Akun">
                <Select
                  value={selectVal}
                  onChange={(e) => setSelectVal(e.target.value)}
                  options={[
                    { value: "active", label: "Aktif" },
                    { value: "inactive", label: "Nonaktif" },
                    { value: "archived", label: "Diarsipkan" },
                  ]}
                />
              </FormField>

              <FormField label="Field Disabled">
                <Input value="Tidak dapat diubah" disabled />
              </FormField>

              <div className="md:col-span-2">
                <FormField label="Catatan Evaluasi">
                  <Textarea value={textareaVal} onChange={(e) => setTextareaVal(e.target.value)} rows={3} />
                </FormField>
              </div>
            </div>
          </Card>
        </ShowcaseSection>

        {/* ── SPRINT 3: SCORE SELECTOR ── */}
        <ShowcaseSection title="Sprint 3 — Interaction Pattern: ScoreSelector">
          <Card padding="md" className="space-y-4">
            <div>
              <Caption className="block mb-2">Desktop View (Compact Radiogroup)</Caption>
              <ScoreSelector value={scoreVal} onChange={setScoreVal} />
            </div>
            <Divider />
            <div>
              <Caption className="block mb-2">Mobile View (Full-Width Touch Target)</Caption>
              <ScoreSelector value={scoreVal} onChange={setScoreVal} isMobile />
            </div>
          </Card>
        </ShowcaseSection>

        {/* ── SPRINT 3 & 4: OVERLAYS ── */}
        <ShowcaseSection title="Sprint 3 & 4 — Overlays: Drawer, Confirmation, & Celebration Modals">
          <Card padding="md" className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setDrawerOpen(true)} leftIcon={<Filter className="w-4 h-4" />}>
              Open Mobile Drawer / Sheet
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setModalVariant("appreciation");
                setModalOpen(true);
              }}
              leftIcon={<Sparkles className="w-4 h-4 text-emerald-500" />}
            >
              Trigger Appreciation Dialog
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setModalVariant("celebration");
                setModalOpen(true);
              }}
              leftIcon={<Sparkles className="w-4 h-4 text-amber-500" />}
            >
              Trigger Milestone Celebration
            </Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} leftIcon={<Trash2 className="w-4 h-4" />}>
              Trigger Confirm Dialog
            </Button>
          </Card>
        </ShowcaseSection>
      </PageContent>

      {/* ── Overlays ── */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Filter Advanced">
        <div className="space-y-4 pt-2">
          <FormField label="Filter Kelas">
            <Select options={[{ value: "7A", label: "Kelas 7A" }, { value: "7B", label: "Kelas 7B" }]} />
          </FormField>
          <FormField label="Filter Status">
            <Select options={[{ value: "ACTIVE", label: "Aktif" }, { value: "INACTIVE", label: "Nonaktif" }]} />
          </FormField>
          <div className="pt-4 flex justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
              Reset
            </Button>
            <Button variant="primary" size="sm" onClick={() => setDrawerOpen(false)}>
              Terapkan Filter
            </Button>
          </div>
        </div>
      </Drawer>

      <MilestoneCelebrationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        variant={modalVariant}
        title={modalVariant === "appreciation" ? "Kerja Bagus!" : "Milestone Tercapai!"}
        description={
          modalVariant === "appreciation"
            ? "100% skor budaya kelas telah lengkap diisi hari ini."
            : "Institusi berhasil menyelesaikan rekapitulasi data akademik."
        }
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hapus item ini?"
        description="Tindakan ini tidak dapat dibatalkan."
        variant="destructive"
        confirmLabel="Ya, Hapus"
        onConfirm={() => setConfirmOpen(false)}
      />

      {showSticky && (
        <PageFooterActions sticky align="right">
          <Button variant="secondary" size="md" onClick={() => setShowSticky(false)}>
            Batal
          </Button>
          <Button variant="primary" size="md" leftIcon={<Loader2 className="w-4 h-4 animate-spin" />} disabled>
            Menyimpan...
          </Button>
        </PageFooterActions>
      )}
    </PageContainer>
  );
}

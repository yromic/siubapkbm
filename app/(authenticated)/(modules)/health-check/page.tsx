"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getHealthCheckV2,
  HealthV2Response,
  HealthV2Section,
  HealthV2Issue,
  HealthV2Status,
  HealthV2Category,
  HealthV2Priority,
} from "@/lib/api/health";
import {
  ErrorState,
  ForbiddenState,
  LoadingState,
  PageHeader,
  ResponsiveContainer,
} from "@/components/ui-states";
import { Badge, BadgeVariant } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { userFacingError } from "@/lib/utils/ui-error";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Server,
  Settings2,
  Cog,
  Database,
  Lightbulb,
  Zap,
  Wrench,
  ExternalLink,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_KEY_PATTERN =
  /password|secret|token|key|hash|cookie|session|credential/i;

const CATEGORY_LABELS: Record<HealthV2Category, string> = {
  infrastructure: "Infrastruktur",
  configuration: "Konfigurasi",
  operations: "Layanan Operasional",
  integrity: "Integritas Data",
};

const CATEGORY_ORDER: HealthV2Category[] = [
  "infrastructure",
  "configuration",
  "operations",
  "integrity",
];

const CATEGORY_ICONS: Record<HealthV2Category, React.ReactElement> = {
  infrastructure: <Server className="w-4 h-4" />,
  configuration: <Settings2 className="w-4 h-4" />,
  operations: <Cog className="w-4 h-4" />,
  integrity: <Database className="w-4 h-4" />,
};

function statusToBadgeVariant(status: HealthV2Status): BadgeVariant {
  if (status === "healthy") return "success";
  if (status === "critical") return "danger";
  if (status === "warning") return "warning";
  return "neutral";
}

function statusLabel(status: HealthV2Status): string {
  if (status === "healthy") return "Sehat";
  if (status === "critical") return "Kritis";
  if (status === "warning") return "Peringatan";
  return "Tidak diketahui";
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
}

function sanitizeDetails(
  details: Record<string, unknown>
): [string, string][] {
  return Object.entries(details)
    .filter(
      ([key, value]) =>
        !SENSITIVE_KEY_PATTERN.test(key) &&
        (typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null)
    )
    .map(([key, value]) => [
      key.replaceAll("_", " "),
      value === null ? "—" : String(value),
    ]);
}

function priorityLabel(priority: HealthV2Priority): string {
  if (priority === "P1") return "P1 — Kritis";
  if (priority === "P2") return "P2 — Peringatan";
  if (priority === "P3") return "P3 — Tidak Diketahui";
  return "—";
}

function priorityBadgeVariant(priority: HealthV2Priority): BadgeVariant {
  if (priority === "P1") return "danger";
  if (priority === "P2") return "warning";
  if (priority === "P3") return "neutral";
  return "neutral";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: HealthV2Status }) {
  if (status === "healthy")
    return (
      <ShieldCheck
        className="w-5 h-5 text-brand-emerald-600 dark:text-brand-emerald-400"
        aria-hidden="true"
      />
    );
  if (status === "critical")
    return (
      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" />
    );
  if (status === "warning")
    return (
      <AlertTriangle
        className="w-5 h-5 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
    );
  return (
    <HelpCircle
      className="w-5 h-5 text-zinc-400 dark:text-zinc-500"
      aria-hidden="true"
    />
  );
}

// Executive Summary strip at the top
function ExecutiveSummary({ data }: { data: HealthV2Response }) {
  const { summary, status } = data;

  // Last checked = most recent section checked_at
  const lastChecked = data.sections.reduce((latest, s) => {
    const t = new Date(s.checked_at).getTime();
    return t > latest ? t : latest;
  }, 0);

  const totalDuration = data.sections.reduce(
    (sum, s) => sum + (s.duration_ms ?? 0),
    0
  );

  return (
    <Card variant="elevated" padding="md" as="section" aria-label="Ringkasan Keseluruhan">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Status headline */}
        <div className="flex items-center gap-3">
          <div
            className={[
              "p-3 rounded-2xl flex-shrink-0",
              status === "healthy"
                ? "bg-brand-emerald-50 dark:bg-brand-emerald-950/30"
                : status === "critical"
                ? "bg-red-50 dark:bg-red-950/30"
                : status === "warning"
                ? "bg-amber-50 dark:bg-amber-950/30"
                : "bg-zinc-100 dark:bg-zinc-800",
            ].join(" ")}
          >
            <StatusIcon status={status} />
          </div>
          <div>
            <p className="text-xs font-medium font-plus-jakarta text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Status Keseluruhan
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge
                variant={statusToBadgeVariant(status)}
                size="md"
                dot
                aria-label={`Status sistem: ${statusLabel(status)}`}
              >
                {statusLabel(status)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:text-right flex-shrink-0">
          {[
            {
              label: "Sehat",
              value: summary.healthy,
              color: "text-brand-emerald-600 dark:text-brand-emerald-400",
            },
            {
              label: "Peringatan",
              value: summary.warning,
              color: "text-amber-600 dark:text-amber-400",
            },
            {
              label: "Kritis",
              value: summary.critical,
              color: "text-red-600 dark:text-red-400",
            },
            {
              label: "Tidak Diketahui",
              value: summary.unknown,
              color: "text-zinc-500 dark:text-zinc-400",
            },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className={`text-xl font-bold font-fredoka ${color}`}>{value}</p>
              <p className="text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400 mt-0.5">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer metadata */}
      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:justify-between gap-2 text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400">
        <span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            {summary.total}
          </span>{" "}
          pemeriksaan dijalankan
        </span>
        <div className="flex gap-4 flex-wrap">
          <span>
            Durasi total:{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {formatDuration(totalDuration)}
            </span>
          </span>
          <span>
            Terakhir diperiksa:{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {lastChecked ? formatDate(new Date(lastChecked).toISOString()) : "—"}
            </span>
          </span>
        </div>
      </div>
    </Card>
  );
}

// Category overview row
function CategoryOverview({ sections }: { sections: HealthV2Section[] }) {
  const byCategory = useMemo(() => {
    const map: Record<string, HealthV2Section[]> = {};
    for (const s of sections) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return map;
  }, [sections]);

  return (
    <section aria-label="Ringkasan Kategori">
      <h2 className="text-sm font-bold font-plus-jakarta text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider">
        Kategori
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CATEGORY_ORDER.map((cat) => {
          const catSections = byCategory[cat] ?? [];
          if (catSections.length === 0) return null;

          const worstStatus: HealthV2Status = catSections.some(
            (s) => s.status === "critical"
          )
            ? "critical"
            : catSections.some((s) => s.status === "warning")
            ? "warning"
            : catSections.some((s) => s.status === "unknown")
            ? "unknown"
            : "healthy";

          const issueCount = catSections.reduce(
            (n, s) => n + (s.issues?.length ?? 0),
            0
          );

          return (
            <Card
              key={cat}
              variant="flat"
              padding="sm"
              as="article"
              aria-label={`Kategori ${CATEGORY_LABELS[cat]}: ${statusLabel(worstStatus)}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-zinc-400 dark:text-zinc-500">
                  {CATEGORY_ICONS[cat]}
                </span>
                <Badge variant={statusToBadgeVariant(worstStatus)} size="sm">
                  {statusLabel(worstStatus)}
                </Badge>
              </div>
              <p className="text-sm font-semibold font-plus-jakarta text-zinc-800 dark:text-zinc-200 leading-tight">
                {CATEGORY_LABELS[cat]}
              </p>
              <p className="mt-1 text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400">
                {catSections.length} checker
                {issueCount > 0 && (
                  <> · <span className="text-amber-600 dark:text-amber-400 font-semibold">{issueCount} issue</span></>
                )}
              </p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// Expandable section card
function SectionCard({ section }: { section: HealthV2Section }) {
  const [expanded, setExpanded] = useState(false);

  const detailRows = useMemo(
    () => sanitizeDetails(section.details),
    [section.details]
  );

  return (
    <Card
      as="article"
      variant={section.status === "critical" ? "default" : "default"}
      padding="md"
      className={
        section.status === "critical"
          ? "border-red-200 dark:border-red-900/60"
          : section.status === "warning"
          ? "border-amber-200 dark:border-amber-900/60"
          : ""
      }
    >
      {/* Header row */}
      <CardHeader
        title={section.title}
        action={
          <Badge variant={statusToBadgeVariant(section.status)} size="sm" dot>
            {statusLabel(section.status)}
          </Badge>
        }
        bordered={expanded}
      />

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 mt-1 text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400">
        <span>
          Kategori:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {CATEGORY_LABELS[section.category] ?? section.category}
          </span>
        </span>
        <span>
          Durasi:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {formatDuration(section.duration_ms)}
          </span>
        </span>
        <span>
          Diperiksa:{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {formatDate(section.checked_at)}
          </span>
        </span>
        {section.issues.length > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-semibold">
            {section.issues.length} issue
          </span>
        )}
      </div>

      {/* Issues inline */}
      {!expanded && section.issues.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Daftar issue">
          {section.issues.slice(0, 2).map((issue) => (
            <li
              key={issue.code}
              className="flex items-start gap-2 text-xs font-plus-jakarta"
            >
              <span className="flex-shrink-0 mt-0.5">
                <StatusIcon status={issue.severity as HealthV2Status} />
              </span>
              <span className="text-zinc-600 dark:text-zinc-300">{issue.message}</span>
            </li>
          ))}
          {section.issues.length > 2 && (
            <li className="text-xs text-zinc-400 pl-7">
              +{section.issues.length - 2} issue lainnya
            </li>
          )}
        </ul>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* All issues */}
          {section.issues.length > 0 && (
            <div>
              <h3 className="text-xs font-bold font-plus-jakarta text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Issue
              </h3>
              <ul className="space-y-2" aria-label="Semua issue">
                {section.issues.map((issue) => (
                  <li
                    key={issue.code}
                    className={[
                      "rounded-xl p-3 text-xs font-plus-jakarta border",
                      issue.severity === "critical"
                        ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50"
                        : issue.severity === "warning"
                        ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50"
                        : "bg-zinc-50 border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700/50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <code className="font-mono text-zinc-500 dark:text-zinc-400">
                        {issue.code}
                      </code>
                      <Badge
                        variant={statusToBadgeVariant(
                          issue.severity as HealthV2Status
                        )}
                        size="sm"
                      >
                        {statusLabel(issue.severity as HealthV2Status)}
                      </Badge>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {issue.message}
                    </p>
                    {/* Sprint 6: Remediation & Operational Guidance */}
                    <RemediationPanel issue={issue} />
                    {/* Technical details — with sensitive fields stripped */}
                    {issue.technical_details &&
                      Object.keys(issue.technical_details).length > 0 && (
                        <TechnicalDetailsBlock
                          details={issue.technical_details}
                          label="Detail teknis issue"
                        />
                      )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Checker details */}
          {detailRows.length > 0 && (
            <div>
              <h3 className="text-xs font-bold font-plus-jakarta text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                Detail Pemeriksaan
              </h3>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                {detailRows.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                      {key}
                    </dt>
                    <dd className="text-xs font-semibold font-plus-jakarta text-zinc-800 dark:text-zinc-200 mt-0.5 truncate">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Empty details */}
          {section.status === "healthy" && section.issues.length === 0 && (
            <p className="text-xs font-plus-jakarta text-brand-emerald-600 dark:text-brand-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Semua pemeriksaan lulus tanpa issue.
            </p>
          )}

          {/* Unknown explanation */}
          {section.status === "unknown" && (
            <p className="text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" aria-hidden="true" />
              Status <em>tidak diketahui</em> berarti pemeriksaan belum dapat
              diverifikasi — bukan kegagalan sistem.
            </p>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs font-semibold font-plus-jakarta text-zinc-500 dark:text-zinc-400 hover:text-brand-emerald-600 dark:hover:text-brand-emerald-400 transition-colors focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1 rounded"
        aria-expanded={expanded}
        aria-controls={`section-detail-${section.id}`}
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            Sembunyikan Detail
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            Lihat Detail
          </>
        )}
      </button>
    </Card>
  );
}

function RemediationPanel({ issue }: { issue: HealthV2Issue }) {
  const priority = issue.priority ?? null;

  return (
    <div className="mt-3 space-y-2.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 p-3 text-xs font-plus-jakarta border border-zinc-200/80 dark:border-zinc-800/80">
      {/* Priority & Auto Repair header */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-1.5 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="flex items-center gap-2">
          {priority && (
            <Badge variant={priorityBadgeVariant(priority)} size="sm">
              {priorityLabel(priority)}
            </Badge>
          )}
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Panduan Penanganan
          </span>
        </div>
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {issue.auto_repair_supported ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <Wrench className="w-3 h-3" aria-hidden="true" /> Auto Repair Didukung
            </span>
          ) : (
            <span className="text-zinc-400">Perbaikan Manual</span>
          )}
        </span>
      </div>

      {/* Impact */}
      {issue.impact && (
        <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
          <Zap className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Dampak: </span>
            <span>{issue.impact}</span>
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
        <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-brand-emerald-500 shrink-0" aria-hidden="true" />
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Rekomendasi: </span>
          <span>{issue.recommendation || "Belum tersedia panduan penanganan."}</span>
        </div>
      </div>

      {/* Documentation URL */}
      {issue.documentation_url && (
        <div className="pt-1 flex items-center gap-1.5 text-brand-emerald-600 dark:text-brand-emerald-400">
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          <a
            href={issue.documentation_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline font-semibold"
          >
            Dokumentasi Penanganan
          </a>
        </div>
      )}
    </div>
  );
}

// Technical details block — strips sensitive keys
function TechnicalDetailsBlock({
  details,
  label,
}: {
  details: Record<string, unknown>;
  label: string;
}) {
  const rows = sanitizeDetails(details);
  if (rows.length === 0) return null;
  return (
    <dl
      className="mt-2 space-y-0.5 border-t border-zinc-200 dark:border-zinc-700 pt-2"
      aria-label={label}
    >
      {rows.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <dt className="text-zinc-400 min-w-0 flex-shrink-0 capitalize">{key}:</dt>
          <dd className="font-medium text-zinc-600 dark:text-zinc-300 truncate">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Issue explorer component
interface FlatIssue extends HealthV2Issue {
  sectionTitle: string;
  category: HealthV2Category;
}

function IssueExplorer({ sections }: { sections: HealthV2Section[] }) {
  const allIssues = useMemo<FlatIssue[]>(
    () =>
      sections.flatMap((s) =>
        (s.issues ?? []).map((issue) => ({
          ...issue,
          sectionTitle: s.title,
          category: s.category,
        }))
      ),
    [sections]
  );

  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      const matchSeverity =
        severityFilter === "all" || issue.severity === severityFilter;
      const matchCategory =
        categoryFilter === "all" || issue.category === categoryFilter;
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        issue.code.toLowerCase().includes(q) ||
        issue.message.toLowerCase().includes(q) ||
        issue.sectionTitle.toLowerCase().includes(q);
      return matchSeverity && matchCategory && matchQuery;
    });
  }, [allIssues, severityFilter, categoryFilter, query]);

  if (allIssues.length === 0) {
    return (
      <section aria-label="Issue Explorer">
        <h2 className="text-sm font-bold font-plus-jakarta text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider">
          Issue Explorer
        </h2>
        <div className="rounded-2xl border border-brand-emerald-200 dark:border-brand-emerald-900/50 bg-brand-emerald-50 dark:bg-brand-emerald-950/20 p-5">
          <div className="flex items-center gap-2 text-sm font-plus-jakarta text-brand-emerald-700 dark:text-brand-emerald-400">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="font-semibold">
              Tidak ada issue yang ditemukan. Sistem dalam kondisi sehat.
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Issue Explorer">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold font-plus-jakarta text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
          Issue Explorer
          <span className="ml-2 text-xs font-normal normal-case text-zinc-400">
            ({filteredIssues.length}/{allIssues.length})
          </span>
        </h2>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            id="issue-search"
            placeholder="Cari berdasarkan code atau pesan..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm font-plus-jakarta rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-emerald-500 focus:border-transparent"
            aria-label="Cari issue"
          />
        </div>

        {/* Severity filter */}
        <select
          id="severity-filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 text-sm font-plus-jakarta rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-emerald-500"
          aria-label="Filter berdasarkan severity"
        >
          <option value="all">Semua Severity</option>
          <option value="critical">Kritis</option>
          <option value="warning">Peringatan</option>
          <option value="unknown">Tidak Diketahui</option>
        </select>

        {/* Category filter */}
        <select
          id="category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm font-plus-jakarta rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-emerald-500"
          aria-label="Filter berdasarkan kategori"
        >
          <option value="all">Semua Kategori</option>
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Issue list */}
      {filteredIssues.length === 0 ? (
        <p className="text-sm font-plus-jakarta text-zinc-500 dark:text-zinc-400 py-6 text-center">
          Tidak ada issue yang cocok dengan filter ini.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredIssues.map((issue, idx) => (
            <article
              key={`${issue.code}-${idx}`}
              className={[
                "rounded-2xl border p-4 text-sm font-plus-jakarta",
                issue.severity === "critical"
                  ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/10"
                  : issue.severity === "warning"
                  ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/10"
                  : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/20",
              ].join(" ")}
              aria-label={`Issue: ${issue.code}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <StatusIcon status={issue.severity as HealthV2Status} />
                  <code className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                    {issue.code}
                  </code>
                </div>
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  <Badge
                    variant={statusToBadgeVariant(
                      issue.severity as HealthV2Status
                    )}
                    size="sm"
                  >
                    {statusLabel(issue.severity as HealthV2Status)}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {CATEGORY_LABELS[issue.category] ?? issue.category}
                  </Badge>
                </div>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {issue.message}
              </p>
              {/* Sprint 6: Remediation & Operational Guidance */}
              <RemediationPanel issue={issue} />
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                Dari:{" "}
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  {issue.sectionTitle}
                </span>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// Section grid grouped by category
function SectionGrid({ sections }: { sections: HealthV2Section[] }) {
  const byCategory = useMemo(() => {
    const map: Record<string, HealthV2Section[]> = {};
    for (const s of sections) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return map;
  }, [sections]);

  return (
    <div className="space-y-6">
      {CATEGORY_ORDER.map((cat) => {
        const catSections = byCategory[cat];
        if (!catSections || catSections.length === 0) return null;
        return (
          <section key={cat} aria-label={`Kategori ${CATEGORY_LABELS[cat]}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-zinc-400 dark:text-zinc-500">
                {CATEGORY_ICONS[cat]}
              </span>
              <h2 className="text-sm font-bold font-plus-jakarta text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {catSections.map((s) => (
                <SectionCard key={s.id} section={s} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HealthCheckV2Page() {
  const { user } = useAuth();
  const [data, setData] = useState<HealthV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowed =
    user?.role === "administrator" || user?.role === "admin";

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getHealthCheckV2();
      setData(result);
    } catch (err) {
      setError(
        userFacingError(
          err,
          "Pemeriksaan sistem gagal dimuat. Silakan coba lagi."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!user || !allowed) {
    return (
      <ForbiddenState message="Anda tidak memiliki izin untuk mengakses halaman ini." />
    );
  }

  if (loading && !data) {
    return <LoadingState message="Memeriksa kondisi sistem..." />;
  }

  return (
    <ResponsiveContainer className="space-y-6 py-6">
      <PageHeader
        title="Pemeriksaan Sistem v2"
        description="Status operasional, konfigurasi, layanan, dan integritas data secara menyeluruh."
        breadcrumbs={[
          { label: "Sistem" },
          { label: "Pemeriksaan Sistem v2" },
        ]}
        actions={
          <button
            id="refresh-health-check"
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[#468432] px-4 py-2.5 text-sm font-semibold font-plus-jakarta text-white hover:bg-[#3a7028] disabled:opacity-60 transition-colors focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2"
            aria-label="Perbarui hasil pemeriksaan sistem"
          >
            <RefreshCw
              className={["w-4 h-4", loading ? "animate-spin" : ""].join(" ")}
              aria-hidden="true"
            />
            {loading ? "Memeriksa..." : "Periksa Ulang"}
          </button>
        }
      />

      {/* Error state */}
      {error && (
        <ErrorState
          message={error}
          onRetry={() => void load()}
          solution="Pastikan server berjalan dan Anda memiliki akses administrator."
        />
      )}

      {/* Dashboard content — only when data is available */}
      {data && (
        <>
          {/* 1. Executive Summary */}
          <ExecutiveSummary data={data} />

          {/* 2. Category Overview */}
          <CategoryOverview sections={data.sections} />

          {/* 3. Issue Explorer */}
          <IssueExplorer sections={data.sections} />

          {/* 4. Section Cards by Category */}
          <SectionGrid sections={data.sections} />
        </>
      )}
    </ResponsiveContainer>
  );
}

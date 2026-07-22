/**
 * Typography — Semantic typography wrappers for the SIUBA admin design system.
 *
 * Design System Reference:
 *   - SIUBA_DESIGN_SYSTEM.md §4 (Typography scale)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §2 (Typography rules)
 *   - Rule 1.1: Fredoka ONLY for h1 page titles and KPI metric values
 *   - Rule 1.2: Plus Jakarta Sans for ALL other interface text
 *   - Rule 1.3: IBM Plex Sans for ALL numeric/tabular/financial data
 *
 * Hierarchy:
 *   Display   → font-fredoka text-3xl+ (landing page only, not for admin)
 *   PageTitle → font-fredoka text-2xl  (admin h1 page titles)
 *   KPIValue  → font-fredoka text-2xl+ (metric numbers on stat cards)
 *   SectionTitle → font-plus-jakarta text-base font-semibold
 *   CardTitle    → font-plus-jakarta text-sm font-semibold
 *   Body         → font-plus-jakarta text-sm
 *   Caption      → font-plus-jakarta text-xs text-zinc-500
 *   Label        → font-plus-jakarta text-xs font-semibold uppercase tracking-wider
 *   NumericDisplay → font-data (IBM Plex Sans) text-sm
 *
 * Usage:
 *   <PageTitle>Siswa</PageTitle>
 *   <SectionTitle>Data Akademik</SectionTitle>
 *   <Body>Teks penjelasan</Body>
 *   <NumericDisplay>1.250.000</NumericDisplay>
 *   <Caption>Terakhir diperbarui: 12 Juli 2025</Caption>
 */

import React from "react";

interface BaseProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
}

// ─────────────────────────────────────────────
// PageTitle — Admin h1 page title (font-fredoka)
// ─────────────────────────────────────────────
export function PageTitle({ children, className = "", id }: BaseProps) {
  return (
    <h1
      id={id}
      className={`font-fredoka text-2xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight leading-tight ${className}`}
    >
      {children}
    </h1>
  );
}

// ─────────────────────────────────────────────
// KPIValue — Metric stat card number (font-fredoka)
// ─────────────────────────────────────────────
export function KPIValue({ children, className = "" }: BaseProps) {
  return (
    <span
      className={`font-fredoka text-3xl font-bold text-zinc-950 dark:text-zinc-50 leading-none ${className}`}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// SectionTitle — h2 section headers (font-plus-jakarta)
// ─────────────────────────────────────────────
export function SectionTitle({ children, className = "", id }: BaseProps) {
  return (
    <h2
      id={id}
      className={`font-plus-jakarta text-base font-semibold text-zinc-900 dark:text-zinc-100 leading-snug ${className}`}
    >
      {children}
    </h2>
  );
}

// ─────────────────────────────────────────────
// CardTitle — h3 within cards (font-plus-jakarta)
// ─────────────────────────────────────────────
export function CardTitle({ children, className = "", id }: BaseProps) {
  return (
    <h3
      id={id}
      className={`font-plus-jakarta text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight ${className}`}
    >
      {children}
    </h3>
  );
}

// ─────────────────────────────────────────────
// Body — Standard body copy (font-plus-jakarta)
// ─────────────────────────────────────────────
export function Body({ children, className = "" }: BaseProps) {
  return (
    <p className={`font-plus-jakarta text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────
// Caption — Secondary/helper text (font-plus-jakarta)
// ─────────────────────────────────────────────
export function Caption({ children, className = "" }: BaseProps) {
  return (
    <span
      className={`font-plus-jakarta text-xs text-zinc-500 dark:text-zinc-400 leading-normal ${className}`}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// HelperText — Form field helper / validation text
// ─────────────────────────────────────────────
export interface HelperTextProps extends BaseProps {
  error?: boolean;
}

export function HelperText({ children, className = "", error = false }: HelperTextProps) {
  return (
    <p
      className={[
        "font-plus-jakarta text-xs leading-snug mt-1",
        error ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────
// Label — Form/table column label
// ─────────────────────────────────────────────
export interface LabelProps extends BaseProps {
  required?: boolean;
  htmlFor?: string;
}

export function Label({ children, className = "", required = false, htmlFor }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`font-plus-jakarta text-sm font-semibold text-zinc-700 dark:text-zinc-300 ${className}`}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
      )}
    </label>
  );
}

// ─────────────────────────────────────────────
// ColumnLabel — Table column / section category header
// ─────────────────────────────────────────────
export function ColumnLabel({ children, className = "" }: BaseProps) {
  return (
    <span
      className={`font-plus-jakarta text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ${className}`}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// NumericDisplay — Tabular/financial/date values (IBM Plex Sans)
// ─────────────────────────────────────────────
export function NumericDisplay({ children, className = "" }: BaseProps) {
  return (
    <span
      className={`font-data text-sm text-zinc-900 dark:text-zinc-100 tabular-nums ${className}`}
    >
      {children}
    </span>
  );
}

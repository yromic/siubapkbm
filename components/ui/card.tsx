/**
 * Card — Reusable surface container following the SIUBA Admin card specification.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 Rule 3.1 (rounded-2xl max, NOT rounded-[24px])
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §3 Rule 2.1 (p-4 or p-5, NOT p-8)
 *   - SIUBA_THEME_SYSTEM.md §4 (Surface 1 = bg-white dark:bg-zinc-900)
 *   - SIUBA_ADMIN_DESIGN_SPECIFICATION.md §3.5 (KPI cards: p-5 rounded-2xl)
 *
 * DOCUMENTED CONFLICT (Sprint 0 baseline §1 Inconsistency 3):
 *   Many existing admin pages use rounded-[20px] which falls between the
 *   design system's allowed admin radius values (rounded-xl / rounded-2xl).
 *   New components from Sprint 2 onward MUST use rounded-2xl (16px) only.
 *   Existing pages using rounded-[20px] will be normalized in their
 *   respective migration sprints.
 *
 * Usage:
 *   <Card>Content</Card>
 *   <Card variant="elevated" padding="lg">
 *     <CardHeader title="Siswa Aktif" />
 *     <CardBody>...</CardBody>
 *   </Card>
 */

import React from "react";

// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────

export type CardVariant =
  | "default"   // Standard elevated card — Surface 1
  | "elevated"  // Stronger shadow emphasis
  | "flat"      // No shadow, border only — for nested cards (Surface 2)
  | "ghost";    // No border, no shadow — transparent container

export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children?: React.ReactNode;
  /** Render as a different HTML element (e.g. "section", "article") */
  as?: React.ElementType;
  /** Hover highlight for interactive/clickable cards */
  interactive?: boolean;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default:
    "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm",
  elevated:
    "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md",
  flat:
    "bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800/60",
  ghost:
    "bg-transparent",
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  className = "",
  children,
  as: Tag = "div",
  interactive = false,
}: CardProps) {
  return (
    <Tag
      className={[
        "rounded-2xl",
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        interactive
          ? "transition-colors duration-150 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

// ─────────────────────────────────────────────
// CardHeader
// ─────────────────────────────────────────────

export interface CardHeaderProps {
  /** Card title — font-plus-jakarta (NOT fredoka — section/card level) */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Optional action slot (icon button, dropdown) */
  action?: React.ReactNode;
  /** Include a visual bottom border separator */
  bordered?: boolean;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  action,
  bordered = false,
  className = "",
}: CardHeaderProps) {
  return (
    <div
      className={[
        "flex items-start justify-between gap-3",
        bordered ? "pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold font-plus-jakarta text-zinc-900 dark:text-zinc-100 leading-tight truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// CardBody
// ─────────────────────────────────────────────

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return <div className={`flex-1 ${className}`}>{children}</div>;
}

// ─────────────────────────────────────────────
// CardFooter
// ─────────────────────────────────────────────

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
  /** Include a visual top border separator */
  bordered?: boolean;
}

export function CardFooter({
  children,
  className = "",
  bordered = false,
}: CardFooterProps) {
  return (
    <div
      className={[
        "flex items-center justify-end gap-2",
        bordered ? "pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

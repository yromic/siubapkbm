/**
 * Badge — Generic semantic status/label badge for admin use.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 Rule 3.3 (rounded-full or rounded-lg)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §5 Rule 4.3 (Status indicator tokens)
 *
 * NOTE: This is the generic UI badge for simple labels and statuses.
 * For entity lifecycle states (ACTIVE, GRADUATED, etc.), use:
 *   @/components/lifecycle-badge (LifecycleBadge)
 *
 * Usage:
 *   <Badge variant="success">Aktif</Badge>
 *   <Badge variant="warning" dot>Perlu Perhatian</Badge>
 *   <Badge variant="neutral" size="md">Draft</Badge>
 */

import React from "react";

export type BadgeVariant =
  | "success"    // emerald — positive/active states
  | "danger"     // red — error/blocked states
  | "warning"    // amber — caution/pending states
  | "info"       // blue — informational states
  | "neutral"    // zinc — inactive/disabled/default states
  | "brand";     // brand-emerald — branded highlights

export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Show a dot indicator before the label */
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success:
    "bg-brand-emerald-50 text-brand-emerald-700 border border-brand-emerald-200 dark:bg-brand-emerald-950/30 dark:text-brand-emerald-400 dark:border-brand-emerald-900/50",
  danger:
    "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50",
  warning:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
  info:
    "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50",
  neutral:
    "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50",
  brand:
    "bg-brand-emerald-50 text-brand-emerald-600 border border-brand-emerald-100 dark:bg-brand-emerald-950/20 dark:text-brand-emerald-400 dark:border-brand-emerald-900/30",
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-brand-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  neutral: "bg-zinc-400",
  brand: "bg-brand-emerald-500",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  dot = false,
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center font-semibold font-plus-jakarta rounded-full",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_CLASSES[variant]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

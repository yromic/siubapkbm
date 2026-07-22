/**
 * Surface — Semantic surface container enforcing the 4-tier surface system.
 *
 * Design System Reference:
 *   - SIUBA_THEME_SYSTEM.md §3 (Surface Tokens)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §5 Rule 4.1 (Semantic surface tokens)
 *   - SIUBA_IMPLEMENTATION_CONTRACT.md §4 Rule 4.2 (Dual-theme support)
 *
 * Surface Hierarchy:
 *   Surface 0: Page base background — bg-surface-0 (fdfbf7 / 0a0a0a)
 *   Surface 1: Elevated cards      — bg-surface-1 (ffffff / 171717)
 *   Surface 2: Hover / nested      — bg-surface-2 (f4f4f5 / 262626)
 *   Surface 3: Borders / dividers  — bg-surface-3 (e4e4e7 / 2d2d2d)
 *
 * DOCUMENTED CONFLICT (Sprint 0 §1 Inconsistency 1):
 *   Tailwind utility bg-zinc-900 (#18181b) ≠ CSS variable --surface-1 (#171717).
 *   Components using this Surface wrapper will correctly use CSS variables.
 *   Legacy components using `dark:bg-zinc-900` will be normalized per sprint plan.
 *
 * Usage:
 *   <Surface level={1} rounded="2xl" padding="md">Card content</Surface>
 *   <Surface level={0}>Page wrapper</Surface>
 */

import React from "react";

export type SurfaceLevel = 0 | 1 | 2 | 3;
export type SurfaceRounded = "none" | "xl" | "2xl";
export type SurfacePadding = "none" | "sm" | "md" | "lg";

export interface SurfaceProps {
  /** Surface tier: 0=page base, 1=cards, 2=hover/nested, 3=border/divider */
  level?: SurfaceLevel;
  rounded?: SurfaceRounded;
  padding?: SurfacePadding;
  bordered?: boolean;
  shadow?: boolean;
  className?: string;
  children?: React.ReactNode;
  as?: React.ElementType;
}

const LEVEL_CLASSES: Record<SurfaceLevel, string> = {
  0: "bg-surface-0",
  1: "bg-surface-1",
  2: "bg-surface-2",
  3: "bg-surface-3",
};

const BORDER_CLASSES: Record<SurfaceLevel, string> = {
  0: "border border-zinc-200 dark:border-zinc-800",
  1: "border border-zinc-200 dark:border-zinc-800",
  2: "border border-zinc-200/80 dark:border-zinc-800/60",
  3: "border border-zinc-300/60 dark:border-zinc-700/40",
};

const ROUNDED_CLASSES: Record<SurfaceRounded, string> = {
  none: "",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

const PADDING_CLASSES: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Surface({
  level = 1,
  rounded = "2xl",
  padding = "none",
  bordered = true,
  shadow = false,
  className = "",
  children,
  as: Tag = "div",
}: SurfaceProps) {
  return (
    <Tag
      className={[
        LEVEL_CLASSES[level],
        ROUNDED_CLASSES[rounded],
        PADDING_CLASSES[padding],
        bordered ? BORDER_CLASSES[level] : "",
        shadow ? "shadow-sm" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

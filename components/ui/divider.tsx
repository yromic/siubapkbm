/**
 * Divider — Horizontal or vertical visual separator.
 *
 * Design System Reference:
 *   - SIUBA_THEME_SYSTEM.md §2 (Surface 3 = borders / dividers)
 *   - Uses border-zinc-100 dark:border-zinc-800 (Surface 3 equivalent)
 *
 * Usage:
 *   <Divider />
 *   <Divider label="atau" />
 *   <Divider orientation="vertical" className="h-6" />
 */

import React from "react";

export interface DividerProps {
  /** Optional label shown at center of divider */
  label?: string;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function Divider({
  label,
  orientation = "horizontal",
  className = "",
}: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`w-px bg-zinc-100 dark:bg-zinc-800 self-stretch ${className}`}
      />
    );
  }

  if (label) {
    return (
      <div role="separator" className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
        <span className="text-xs font-medium font-plus-jakarta text-zinc-400 dark:text-zinc-500 flex-shrink-0">
          {label}
        </span>
        <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  return (
    <hr
      role="separator"
      className={`h-px border-0 bg-zinc-100 dark:bg-zinc-800 ${className}`}
    />
  );
}

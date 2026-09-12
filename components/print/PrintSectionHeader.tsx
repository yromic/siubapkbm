"use client";

import React, { ReactNode } from "react";

export type PrintHeaderVariant = "primary" | "secondary" | "accent" | "neutral";

interface PrintSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: string;
  variant?: PrintHeaderVariant;
  className?: string;
}

const VARIANT_STYLES: Record<
  PrintHeaderVariant,
  { border: string; bg: string; text: string; badgeBg: string; badgeText: string }
> = {
  primary: {
    border: "border-l-4 border-emerald-600",
    bg: "bg-emerald-50/70",
    text: "text-emerald-950",
    badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-300",
    badgeText: "text-emerald-800",
  },
  secondary: {
    border: "border-l-4 border-blue-600",
    bg: "bg-blue-50/70",
    text: "text-blue-950",
    badgeBg: "bg-blue-100 text-blue-800 border-blue-300",
    badgeText: "text-blue-800",
  },
  accent: {
    border: "border-l-4 border-amber-500",
    bg: "bg-amber-50/70",
    text: "text-amber-950",
    badgeBg: "bg-amber-100 text-amber-800 border-amber-300",
    badgeText: "text-amber-800",
  },
  neutral: {
    border: "border-l-4 border-slate-600",
    bg: "bg-slate-100/70",
    text: "text-slate-900",
    badgeBg: "bg-slate-200 text-slate-800 border-slate-300",
    badgeText: "text-slate-700",
  },
};

/**
 * PrintSectionHeader
 *
 * Official academic section divider with a left color accent border,
 * subtle tinted background, and built-in orphan protection (break-after: avoid).
 */
export function PrintSectionHeader({
  title,
  subtitle,
  icon,
  badge,
  variant = "primary",
  className = "",
}: PrintSectionHeaderProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={`print-break-inside-avoid print-break-after-avoid flex items-center justify-between px-3 py-1.5 rounded-r-md ${styles.border} ${styles.bg} ${className}`}
      style={{ breakAfter: "avoid", pageBreakAfter: "avoid" }}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-current opacity-80 flex-shrink-0">{icon}</span>}
        <div>
          <h3 className={`text-xs sm:text-sm font-bold uppercase tracking-wide leading-tight ${styles.text}`}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-gray-500 font-normal leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {badge && (
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${styles.badgeBg}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

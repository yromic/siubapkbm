/**
 * KPICard — Standardized primary, secondary, and trend KPI metric card.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_DESIGN_SPECIFICATION.md §3.5 (KPI Cards: p-5 rounded-2xl)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §2 (Rule 1.1: KPI numbers MUST use font-fredoka)
 *   - SIUBA_THEME_SYSTEM.md §4 (Surface 1 container)
 */

import React from "react";
import { Card, CardProps } from "./card";
import { KPIValue, Caption, ColumnLabel } from "./typography";
import { ArrowUpRight, ArrowDownRight, Minus, Loader2 } from "lucide-react";

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string | number;
    label?: string;
    direction: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  loading?: boolean;
  error?: string;
  variant?: CardProps["variant"];
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  loading = false,
  error,
  variant = "default",
  className = "",
}: KPICardProps) {
  if (loading) {
    return (
      <Card variant={variant} padding="md" className={className}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="h-3.5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
        </div>
        <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse mb-2" />
        <div className="h-3 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="flat" padding="md" className={`border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10 ${className}`}>
        <ColumnLabel className="text-red-500">{title}</ColumnLabel>
        <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
      </Card>
    );
  }

  const getTrendBadge = () => {
    if (!trend) return null;
    const isUp = trend.direction === "up";
    const isDown = trend.direction === "down";

    const colorClasses = isUp
      ? "bg-brand-emerald-50 text-brand-emerald-700 dark:bg-brand-emerald-950/40 dark:text-brand-emerald-400"
      : isDown
      ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";

    const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;

    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold font-plus-jakarta ${colorClasses}`}>
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{trend.value}</span>
      </span>
    );
  };

  return (
    <Card variant={variant} padding="md" className={className}>
      <div className="flex items-start justify-between gap-3">
        <ColumnLabel className="truncate">{title}</ColumnLabel>
        {icon && (
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <KPIValue>{value}</KPIValue>
        {trend && getTrendBadge()}
      </div>

      {(subtitle || trend?.label) && (
        <Caption className="mt-1.5 block truncate">
          {subtitle || trend?.label}
        </Caption>
      )}
    </Card>
  );
}

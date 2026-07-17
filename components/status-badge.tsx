"use client";

import React from "react";

export type StudentStatus = string;

export function StatusBadge({ status }: { status: StudentStatus }) {
  const isActive = status === "Aktif" || status === "active";
  const displayLabel = status === "active" ? "Aktif" : status === "inactive" ? "Tidak aktif" : status;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        isActive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {displayLabel}
    </span>
  );
}

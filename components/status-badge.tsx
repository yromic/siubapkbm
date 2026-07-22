"use client";

import React from "react";
import { Badge, BadgeVariant } from "@/components/ui/badge";

export type StudentStatus = string;

/**
 * StatusBadge — Legacy wrapper around generic Badge for backward compatibility.
 */
export function StatusBadge({ status }: { status: StudentStatus }) {
  const isActive = status === "Aktif" || status === "active";
  const displayLabel = status === "active" ? "Aktif" : status === "inactive" ? "Tidak aktif" : status;
  const variant: BadgeVariant = isActive ? "success" : "neutral";

  return (
    <Badge variant={variant} size="sm" dot={isActive}>
      {displayLabel}
    </Badge>
  );
}

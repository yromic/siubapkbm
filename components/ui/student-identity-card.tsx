/**
 * StudentIdentityCard — Reusable domain presentation component for student profile headers.
 *
 * Domain Scope: Educational UI / SIUBA Admin
 * Layer: Layer 8 (Business Components)
 * Responsibilities: Render student name, NISN, NIK, class, and status badge. NO business logic.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LifecycleBadge, LifecycleStatus } from "@/components/lifecycle-badge";
import { NumericDisplay } from "@/components/ui/typography";

export interface StudentIdentityCardProps {
  name: string;
  nisn?: string;
  nik?: string;
  classNameLabel?: string;
  status: LifecycleStatus;
  avatarSrc?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function StudentIdentityCard({
  name,
  nisn,
  nik,
  classNameLabel,
  status,
  avatarSrc,
  actions,
  className = "",
}: StudentIdentityCardProps) {
  return (
    <Card variant="default" padding="md" className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <Avatar name={name} src={avatarSrc} size="lg" />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold font-plus-jakarta text-zinc-900 dark:text-zinc-100 truncate">
                {name}
              </h2>
              <LifecycleBadge status={status} />
              {classNameLabel && <Badge variant="brand">{classNameLabel}</Badge>}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
              {nisn && (
                <span>
                  NISN: <NumericDisplay className="font-semibold">{nisn}</NumericDisplay>
                </span>
              )}
              {nik && (
                <span>
                  NIK: <NumericDisplay className="font-semibold">{nik}</NumericDisplay>
                </span>
              )}
            </div>
          </div>
        </div>

        {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </Card>
  );
}

/**
 * AcademicScoreCard — Reusable domain presentation component for student academic scores.
 *
 * Domain Scope: Educational UI / SIUBA Admin
 * Layer: Layer 8 (Business Components)
 * Responsibilities: Render subject score, predicate, and passing status indicator. NO business logic.
 */

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumericDisplay, Caption } from "@/components/ui/typography";

export interface AcademicScoreCardProps {
  subjectName: string;
  score: number | null;
  passingGrade?: number;
  predicate?: string;
  teacherName?: string;
  className?: string;
}

export function AcademicScoreCard({
  subjectName,
  score,
  passingGrade = 75,
  predicate,
  teacherName,
  className = "",
}: AcademicScoreCardProps) {
  const isPassed = score !== null && score >= passingGrade;

  return (
    <Card variant="default" padding="sm" className={`space-y-2 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold font-plus-jakarta text-zinc-900 dark:text-zinc-100 truncate">
            {subjectName}
          </h3>
          {teacherName && <Caption className="block truncate">Pengampu: {teacherName}</Caption>}
        </div>

        {score !== null ? (
          <Badge variant={isPassed ? "success" : "danger"} dot>
            {isPassed ? "Tuntas" : "Belum Tuntas"}
          </Badge>
        ) : (
          <Badge variant="neutral">Belum Diisi</Badge>
        )}
      </div>

      <div className="flex items-baseline justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
        <Caption>Nilai Akhir (KKM: {passingGrade})</Caption>
        <div className="flex items-baseline gap-1.5">
          <NumericDisplay className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {score !== null ? score : "-"}
          </NumericDisplay>
          {predicate && (
            <span className="text-xs font-semibold font-plus-jakarta text-brand-emerald-600 dark:text-brand-emerald-400">
              ({predicate})
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

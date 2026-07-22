/**
 * ScoreSelector — Shared touch-optimized 4-option score radio group component.
 *
 * Design System Reference:
 *   - SIUBA_COMPONENT_LIBRARY.md §2.2
 *   - SIUBA_ADMIN_UX_RESEARCH.md §4.1
 *   - Extracted from app/(authenticated)/(modules)/daily-culture/page.tsx:L82
 */

import React from "react";

export interface ScoreSelectorProps {
  value: number | null;
  onChange: (val: number | null) => void;
  disabled?: boolean;
  isMobile?: boolean;
}

const SCORE_LABELS: Record<number, { short: string; full: string }> = {
  1: { short: "PB", full: "Perlu Bimbingan" },
  2: { short: "C", full: "Cukup" },
  3: { short: "B", full: "Baik" },
  4: { short: "SB", full: "Sangat Baik" },
};

export function ScoreSelector({
  value,
  onChange,
  disabled = false,
  isMobile = false,
}: ScoreSelectorProps) {
  const options = [1, 2, 3, 4] as const;

  const handleKeyDown = (e: React.KeyboardEvent, currentScore: number) => {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = currentScore < 4 ? currentScore + 1 : 1;
      onChange(next);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = currentScore > 1 ? currentScore - 1 : 4;
      onChange(prev);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onChange(null);
    }
  };

  if (isMobile) {
    return (
      <div
        role="radiogroup"
        aria-label="Pilih Skor Budaya"
        className="flex items-center gap-1.5 w-full"
      >
        {options.map((score) => {
          const isSelected = value === score;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(isSelected ? null : score)}
              onKeyDown={(e) => handleKeyDown(e, score)}
              className={[
                "flex-1 py-2 px-1 rounded-xl text-xs font-bold font-plus-jakarta transition-all cursor-pointer select-none text-center",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1",
                isSelected
                  ? "bg-brand-emerald-600 text-white shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700/60",
                disabled ? "opacity-40 cursor-not-allowed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={`${SCORE_LABELS[score].short} - ${SCORE_LABELS[score].full}`}
            >
              <div className="text-xs">{SCORE_LABELS[score].short}</div>
              <div className="text-[10px] opacity-80 font-data">{score}</div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Pilih Skor Budaya"
      className="flex items-center justify-center gap-1"
    >
      {options.map((score) => {
        const isSelected = value === score;
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(isSelected ? null : score)}
            onKeyDown={(e) => handleKeyDown(e, score)}
            className={[
              "w-8 h-8 rounded-xl text-xs font-bold font-plus-jakarta flex items-center justify-center transition-all cursor-pointer select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1",
              isSelected
                ? "bg-brand-emerald-600 text-white shadow-sm"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700",
              disabled ? "opacity-40 cursor-not-allowed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={`${score} - ${SCORE_LABELS[score].full}`}
          >
            {score}
          </button>
        );
      })}
    </div>
  );
}

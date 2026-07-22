/**
 * Textarea — Standardized multiline text input component.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 (Radius: rounded-xl / 12px)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §8 (Focus ring: focus-visible:ring-2)
 */

import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, disabled, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={[
          "w-full px-3.5 py-2.5 text-sm font-plus-jakarta font-medium rounded-xl border transition-all resize-none",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
          error
            ? "border-red-400 dark:border-red-600 bg-red-50/50 dark:bg-red-950/10 focus-visible:ring-red-400/30 focus-visible:border-red-500"
            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus-visible:ring-brand-emerald-500/30 focus-visible:border-brand-emerald-600",
          "focus-visible:outline-none focus-visible:ring-2",
          disabled ? "opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

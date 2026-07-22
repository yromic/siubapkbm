/**
 * FormField — Reusable form label, hint, and validation message wrapper.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 (Radius: rounded-xl / 12px)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §2 (Font: font-plus-jakarta for form text)
 */

import React from "react";
import { Label } from "./typography";

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={htmlFor} required={required} className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 font-plus-jakarta">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-plus-jakarta">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

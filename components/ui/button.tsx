/**
 * Button — Reusable semantic button following SIUBA Admin UI Guidelines.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §5 Rule 4.2 (Primary Actions)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 Rule 3.2 (Radius: rounded-xl / 12px)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §8 Rule 9.1 (Focus rings)
 *
 * Typography:
 *   - font-plus-jakarta for all button labels (Rule 1.2)
 *
 * Usage:
 *   <Button variant="primary" onClick={handleSave}>Simpan</Button>
 *   <Button variant="secondary" leftIcon={<Plus />}>Tambah</Button>
 *   <Button variant="destructive" loading>Menghapus...</Button>
 */

import React from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"    // bg-brand-emerald-600 — primary actions (Save, Submit)
  | "secondary"  // border + bg-white — secondary actions (Cancel, Export)
  | "ghost"      // transparent, hover only — tertiary/nav actions
  | "destructive"; // bg-red-600 — destructive actions (Delete, Reset)

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-emerald-600 text-white hover:bg-brand-emerald-700 active:bg-brand-emerald-700 shadow-sm border border-brand-emerald-700/20",
  secondary:
    "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800",
  ghost:
    "bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-700 shadow-sm border border-red-700/20",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-5 py-3 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center",
        "font-plus-jakarta font-semibold",
        "rounded-xl",
        "transition-colors duration-150",
        "cursor-pointer",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" aria-hidden="true" />
      ) : (
        leftIcon && <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && rightIcon && (
        <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
}

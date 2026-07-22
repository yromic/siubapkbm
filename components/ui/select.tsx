/**
 * Select — Standardized native select wrapper component.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 (Radius: rounded-xl / 12px)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §8 (Focus ring: focus-visible:ring-2)
 */

import React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", options, placeholder = "Pilih...", error, disabled, value, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          value={value}
          disabled={disabled}
          className={[
            "w-full h-11 pl-3.5 pr-10 py-2.5 text-sm font-plus-jakarta font-medium rounded-xl border transition-all appearance-none cursor-pointer",
            "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
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
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";

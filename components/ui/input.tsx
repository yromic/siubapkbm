/**
 * Input — Standardized text input control component.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 (Radius: rounded-xl / 12px)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §8 (Focus ring: focus-visible:ring-2)
 */

import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, leftIcon, rightIcon, disabled, type = "text", ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={[
            "w-full h-11 px-3.5 py-2.5 text-sm font-plus-jakarta font-medium rounded-xl border transition-all",
            "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
            leftIcon ? "pl-10" : "",
            rightIcon ? "pr-10" : "",
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
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-400">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

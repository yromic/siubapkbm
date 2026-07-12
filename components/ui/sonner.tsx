"use client";

import { Toaster } from "sonner";

/**
 * SonnerToaster — Global toast provider configured for SIUBA design system.
 * Mount this once in the root layout. Use `notify` from `lib/notify.ts` everywhere else.
 */
export function SonnerToaster() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
          fontSize: "0.875rem",
          borderRadius: "0.75rem",
        },
        classNames: {
          toast: "border shadow-lg",
          title: "font-semibold",
          description: "text-sm opacity-80",
        },
      }}
    />
  );
}

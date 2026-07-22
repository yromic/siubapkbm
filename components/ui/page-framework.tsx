/**
 * Page Framework — Structural page composition components.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_DESIGN_SPECIFICATION.md §2 (Mobile First Foundation)
 *   - SIUBA_ADMIN_DESIGN_SPECIFICATION.md §3.2 (Keyboard avoidance: pb-20 md:pb-6)
 *   - SIUBA_INFORMATION_ARCHITECTURE.md §4 (Module routing reference)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §3 Rule 2.2 (Section margins ≤ mb-6)
 *
 * Standard page composition:
 *
 *   <PageContainer>
 *     <PageHeader title="Siswa" description="..." />
 *     <PageToolbar>
 *       <SearchBar ... />
 *       <Button>Filter</Button>
 *     </PageToolbar>
 *     <PageContent>
 *       <PageSection>
 *         ...content...
 *       </PageSection>
 *     </PageContent>
 *     <PageFooterActions>
 *       <Button variant="primary">Simpan</Button>
 *     </PageFooterActions>
 *   </PageContainer>
 *
 * Notes:
 *   - PageContainer enforces max-w-7xl and responsive horizontal padding.
 *   - PageFooterActions is sticky on mobile (above bottom nav at bottom-16).
 *   - PageToolbar handles filter/search rows with consistent vertical rhythm.
 */

import React from "react";

// ─────────────────────────────────────────────
// PageContainer
// ─────────────────────────────────────────────

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Override the max-width constraint.
   * Defaults to max-w-7xl (1280px) per design system.
   */
  maxWidth?: "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full";
}

const MAX_WIDTH_CLASSES: Record<NonNullable<PageContainerProps["maxWidth"]>, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export function PageContainer({
  children,
  className = "",
  maxWidth = "7xl",
}: PageContainerProps) {
  return (
    <div
      className={[
        "w-full mx-auto",
        "px-4 sm:px-6 lg:px-8",
        "py-5 sm:py-6 lg:py-8",
        "space-y-6",
        MAX_WIDTH_CLASSES[maxWidth],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// PageToolbar
// ─────────────────────────────────────────────
// Filter/search bar area between PageHeader and main content.

export interface PageToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function PageToolbar({ children, className = "" }: PageToolbarProps) {
  return (
    <div
      className={[
        "flex flex-col sm:flex-row gap-3 items-start sm:items-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// PageContent
// ─────────────────────────────────────────────
// Main content area wrapper. Provides consistent vertical spacing.

export interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContent({ children, className = "" }: PageContentProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────
// PageSection
// ─────────────────────────────────────────────
// Logical grouping within a page. Optional title. Max mb-6 per Rule 2.2.

export interface PageSectionProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageSection({
  children,
  title,
  description,
  action,
  className = "",
}: PageSectionProps) {
  return (
    <section className={`space-y-3 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold font-plus-jakarta text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs font-plus-jakarta text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────
// PageFooterActions
// ─────────────────────────────────────────────
// Sticky action bar. On mobile: docked above bottom nav (bottom-16).
// On desktop: inline / normal flow (can be used at page bottom).
// For form save buttons, filter submits, batch operations.

export interface PageFooterActionsProps {
  children: React.ReactNode;
  className?: string;
  /** Make this bar sticky — positioned above mobile bottom nav */
  sticky?: boolean;
  /** Alignment of actions: left, center, right */
  align?: "left" | "center" | "right";
}

const ALIGN_CLASSES: Record<NonNullable<PageFooterActionsProps["align"]>, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

export function PageFooterActions({
  children,
  className = "",
  sticky = false,
  align = "right",
}: PageFooterActionsProps) {
  if (sticky) {
    return (
      <>
        {/* Mobile: sticky above bottom nav */}
        <div
          className={[
            "block md:hidden",
            "fixed bottom-16 left-0 right-0 z-30",
            "px-4 py-3",
            "bg-surface-1/95 backdrop-blur-md",
            "border-t border-zinc-200 dark:border-zinc-800",
            "shadow-lg",
            "flex items-center gap-3",
            ALIGN_CLASSES[align],
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          role="region"
          aria-label="Tindakan halaman"
        >
          {children}
        </div>
        {/* Desktop: normal inline flow */}
        <div
          className={[
            "hidden md:flex items-center gap-3",
            ALIGN_CLASSES[align],
            "pt-2",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>
      </>
    );
  }

  return (
    <div
      className={[
        "flex items-center gap-3 flex-wrap",
        ALIGN_CLASSES[align],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-label="Tindakan halaman"
    >
      {children}
    </div>
  );
}

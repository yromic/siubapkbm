/**
 * Tabs — Reusable accessible tab navigation component.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §4 (Radius: rounded-xl / 12px)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §8 (Focus ring: focus-visible:ring-2)
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §2 (Font: font-plus-jakarta for UI controls)
 *
 * Usage:
 *   <Tabs
 *     items={[
 *       { id: "years", label: "Tahun Ajaran", badge: "2" },
 *       { id: "semesters", label: "Semester" }
 *     ]}
 *     activeId={activeTab}
 *     onChange={setActiveTab}
 *   />
 */

import React from "react";

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: "line" | "pills";
  className?: string;
}

export function Tabs({
  items,
  activeId,
  onChange,
  variant = "line",
  className = "",
}: TabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const enabledItems = items.filter((item) => !item.disabled);
    const currentIndex = enabledItems.findIndex((item) => item.id === activeId);

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextItem = enabledItems[(currentIndex + 1) % enabledItems.length];
      if (nextItem) onChange(nextItem.id);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevItem = enabledItems[(currentIndex - 1 + enabledItems.length) % enabledItems.length];
      if (prevItem) onChange(prevItem.id);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (enabledItems[0]) onChange(enabledItems[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      if (enabledItems[enabledItems.length - 1]) onChange(enabledItems[enabledItems.length - 1].id);
    }
  };

  if (variant === "pills") {
    return (
      <div
        role="tablist"
        className={`flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl max-w-fit ${className}`}
      >
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${item.id}`}
              id={`tab-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1",
                isActive
                  ? "bg-white dark:bg-zinc-900 text-brand-emerald-600 dark:text-brand-emerald-400 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200",
                item.disabled ? "opacity-40 cursor-not-allowed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-brand-emerald-100 text-brand-emerald-700 dark:bg-brand-emerald-950/60 dark:text-brand-emerald-300"
                      : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={`flex border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-none ${className}`}
    >
      {items.map((item, index) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              "flex items-center gap-2 px-4 py-2.5 font-bold text-sm border-b-2 transition-all whitespace-nowrap cursor-pointer select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-1 rounded-t-lg",
              isActive
                ? "border-emerald-500 text-brand-emerald-600 dark:text-brand-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
              item.disabled ? "opacity-40 cursor-not-allowed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isActive
                    ? "bg-brand-emerald-100 text-brand-emerald-700 dark:bg-brand-emerald-950/60 dark:text-brand-emerald-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

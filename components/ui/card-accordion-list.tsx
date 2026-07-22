/**
 * CardAccordionList — Standardized mobile card accordion list component.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_UI_GUIDELINES.md §6 (Mobile accordion block md:hidden pattern)
 *   - SIUBA_ADMIN_DESIGN_SPECIFICATION.md §3.4 (Mobile Card Accordion List)
 */

import React, { useState } from "react";
import { Card } from "./card";
import { ChevronDown } from "lucide-react";

export interface CardAccordionItemProps {
  id: string | number;
  header: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function CardAccordionItem({
  header,
  summary,
  children,
  defaultExpanded = false,
}: CardAccordionItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card variant="default" padding="none" className="overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="p-4 flex items-start justify-between gap-3 cursor-pointer select-none hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{header}</div>
          {summary && <div className="text-xs text-zinc-500 dark:text-zinc-400">{summary}</div>}
        </div>
        <div className="p-1 rounded-lg text-zinc-400 flex-shrink-0 mt-0.5">
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-900/40 text-xs">
          {children}
        </div>
      )}
    </Card>
  );
}

export interface CardAccordionListProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  renderHeader: (item: T, index: number) => React.ReactNode;
  renderSummary?: (item: T, index: number) => React.ReactNode;
  renderDetails: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function CardAccordionList<T>({
  data,
  keyExtractor,
  renderHeader,
  renderSummary,
  renderDetails,
  className = "",
}: CardAccordionListProps<T>) {
  return (
    <div className={`block md:hidden space-y-3 ${className}`}>
      {data.map((item, index) => {
        const key = keyExtractor(item, index);
        return (
          <CardAccordionItem
            key={key}
            id={key}
            header={renderHeader(item, index)}
            summary={renderSummary ? renderSummary(item, index) : undefined}
          >
            {renderDetails(item, index)}
          </CardAccordionItem>
        );
      })}
    </div>
  );
}

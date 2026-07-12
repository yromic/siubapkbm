"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={className}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 justify-center",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center mb-4",
        caption_label: "text-xs font-bold text-zinc-900 dark:text-zinc-50",
        nav: "space-x-1 flex items-center",
        button_previous: "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition absolute left-1",
        button_next: "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition absolute right-1",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between w-full mb-1",
        weekday: "text-zinc-400 dark:text-zinc-500 rounded-md w-9 font-semibold text-[10px] uppercase tracking-wider text-center flex items-center justify-center",
        week: "flex w-full mt-1.5 justify-between",
        day: "h-9 w-9 p-0 font-medium text-zinc-700 dark:text-zinc-300 rounded-md flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer",
        day_today: "border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-150 font-bold",
        day_outside: "text-zinc-400 dark:text-zinc-650 opacity-40",
        day_disabled: "text-zinc-400 dark:text-zinc-650 opacity-40",
        day_hidden: "invisible",
        ...classNames,
      } as any}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      } as any}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

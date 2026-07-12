"use client";

import React, { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { id as idLocale } from "date-fns/locale";
import { format, parse, isValid } from "date-fns";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

export interface DatePickerProps {
  /** Value dalam format "YYYY-MM-DD" (ISO date string, tanpa time) */
  value: string;
  /** Callback dipanggil dengan format "YYYY-MM-DD" */
  onChange: (value: string) => void;
  /** Label field — ditampilkan di atas input */
  label?: string;
  /** Placeholder saat tidak ada tanggal terpilih */
  placeholder?: string;
  /** Disable seluruh komponen */
  disabled?: boolean;
  /** Tanggal minimum yang bisa dipilih (YYYY-MM-DD) */
  minDate?: string;
  /** Tanggal maksimum yang bisa dipilih (YYYY-MM-DD) */
  maxDate?: string;
  /** ID unik untuk label/input pairing aksesibilitas */
  id?: string;
  /** Apakah field wajib diisi */
  required?: boolean;
  /** Pesan error validasi */
  error?: string;
}

const DATE_FORMAT_DISPLAY = "d MMMM yyyy";
const DATE_FORMAT_ISO = "yyyy-MM-dd";

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, DATE_FORMAT_ISO, new Date());
  return isValid(parsed) ? parsed : undefined;
}

function formatIso(date: Date): string {
  return format(date, DATE_FORMAT_ISO);
}

function formatDisplay(date: Date): string {
  return format(date, DATE_FORMAT_DISPLAY, { locale: idLocale });
}

interface CustomDropdownProps {
  value?: string | number;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  options?: Array<{ value: string | number; label: string; disabled?: boolean }>;
  "aria-label"?: string;
}

/**
 * CustomDropdown — Komponen dropdown custom pengganti tag select bawaan browser.
 * Didesain premium agar seragam di semua platform, menggunakan radix/tailwind pattern.
 */
function CustomDropdown({ value, onChange, options = [], "aria-label": ariaLabel }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const handleSelect = (val: string | number) => {
    if (onChange) {
      const event = {
        target: { value: String(val) },
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(event);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-bold text-zinc-900 dark:text-zinc-50 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        <span>{selectedOption ? selectedOption.label : value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-36 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 shadow-xl p-1 animate-fadeIn scrollbar-thin">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                disabled={opt.disabled}
                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors truncate ${
                  isSelected
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * DatePicker — Komponen pemilih tanggal dengan kalender visual.
 *
 * Menggantikan `<input type="date">` di seluruh aplikasi.
 * - Memperbaiki Hydration Error (menghilangkan bersarangnya button di dalam button).
 * - Menggunakan kustomisasi Dropdown premium yang seragam di semua platform.
 */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Pilih tanggal...",
  disabled = false,
  minDate,
  maxDate,
  id,
  required = false,
  error,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = id || `datepicker-${React.useId()}`;

  const selectedDate = parseIsoDate(value);
  
  // Batas tahun fleksibel untuk sekolah: dari 1970 s.d. tahun berjalan + 5
  const defaultMinYear = 1970;
  const defaultMaxYear = new Date().getFullYear() + 5;
  
  const fromDate = minDate ? parseIsoDate(minDate) : new Date(defaultMinYear, 0, 1);
  const toDate = maxDate ? parseIsoDate(maxDate) : new Date(defaultMaxYear, 11, 31);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Esc key
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      onChange(formatIso(day));
      setOpen(false);
    }
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((prev) => !prev);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-zinc-650 dark:text-zinc-400 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger Wrapper menggunakan DIV untuk menghindari Button bertumpuk (HTML validation fix) */}
      <div
        id={inputId}
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm text-left transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer select-none ${
          error
            ? "border-red-400 dark:border-red-600 focus:ring-red-400/30 bg-red-50 dark:bg-red-950/10"
            : open
            ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-white dark:bg-zinc-900"
            : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
        }`}
      >
        <Calendar className={`w-4 h-4 shrink-0 ${selectedDate ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-400"}`} />
        <span className={`flex-1 truncate ${selectedDate ? "text-zinc-900 dark:text-zinc-50 font-medium" : "text-zinc-400"}`}>
          {selectedDate ? formatDisplay(selectedDate) : placeholder}
        </span>
        {selectedDate && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Hapus tanggal"
            className="shrink-0 p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-150 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Calendar Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Pilih tanggal"
          className="absolute z-50 mt-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-3 animate-fadeIn"
          style={{ minWidth: "280px" }}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={idLocale}
            startMonth={fromDate}
            endMonth={toDate}
            defaultMonth={selectedDate || new Date()}
            showOutsideDays
            captionLayout="dropdown"
            components={{
              // Hubungkan custom dropdown ke react-day-picker v10 custom components mapping
              Dropdown: ({ value, onChange, options }) => {
                // Konversi options dari react-day-picker ke format yang didukung CustomDropdown
                const formattedOptions = (options || []).map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                  disabled: opt.disabled,
                }));
                return (
                  <CustomDropdown
                    value={value as string | number}
                    onChange={onChange as React.ChangeEventHandler<HTMLSelectElement>}
                    options={formattedOptions}
                  />
                );
              },
            }}
            classNames={{
              root: "w-full",
              months: "flex flex-col",
              month: "space-y-3",
              month_caption: "flex justify-between items-center px-1 mb-2 gap-1",
              caption_label: "hidden", // Sembunyikan label statis karena kita menggunakan dropdown kustom
              dropdowns: "flex items-center gap-1.5 text-sm font-bold text-zinc-950 dark:text-zinc-50",
              dropdown: "hidden", // Sembunyikan elemen select bawaan HTML
              dropdown_root: "relative inline-flex items-center",
              nav: "flex gap-1 items-center",
              button_previous:
                "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors",
              button_next:
                "p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday:
                "text-zinc-400 text-[11px] font-bold text-center w-9 pb-2",
              weeks: "mt-1",
              week: "flex w-full mt-1",
              day: "text-center text-sm relative w-9 h-9 p-0 focus-within:z-20",
              day_button:
                "w-9 h-9 rounded-xl text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
              today:
                "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl",
              outside: "opacity-30",
              disabled: "opacity-30 cursor-not-allowed",
              selected:
                "[&>button]:bg-emerald-600 [&>button]:text-white [&>button]:hover:bg-emerald-700 [&>button]:font-semibold",
              hidden: "invisible",
            }}
          />
        </div>
      )}
    </div>
  );
}

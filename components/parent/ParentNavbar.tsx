"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useParentAuth } from "@/hooks/useParentAuth";
import { useWebsiteBranding } from "@/hooks/useWebsiteBranding";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  LayoutDashboard,
  Sparkles,
  Award,
  CreditCard,
  LogOut,
  Printer,
  ChevronLeft,
} from "lucide-react";

interface ParentNavbarProps {
  studentName?: string;
  studentClass?: string;
  nisn?: string;
  title?: string;
  showBack?: boolean;
}

export function ParentNavbar({
  studentName,
  studentClass,
  nisn,
  title,
  showBack = false,
}: ParentNavbarProps) {
  const pathname = usePathname();
  const { logout } = useParentAuth();
  const { branding } = useWebsiteBranding();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navItems = [
    {
      label: "Ringkasan",
      href: "/parent/dashboard",
      icon: LayoutDashboard,
      active: pathname === "/parent/dashboard",
    },
    {
      label: "Karakter UTSMAN",
      href: "/parent/character",
      icon: Sparkles,
      active: pathname === "/parent/character",
    },
    {
      label: "Nilai & KKTP",
      href: "/parent/academic",
      icon: Award,
      active: pathname === "/parent/academic",
    },
    {
      label: "Keuangan SPP",
      href: "/parent/spp",
      icon: CreditCard,
      active: pathname === "/parent/spp",
    },
  ];

  return (
    <>
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Left: Brand Logo & Optional Mobile Back */}
            <div className="flex items-center gap-3">
              {showBack && (
                <Link
                  href="/parent/dashboard"
                  className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Kembali ke Dashboard"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              )}

              <Link href="/parent/dashboard" className="flex items-center gap-2.5 group" aria-label="Portal Wali Murid">
                {branding.logo_url ? (
                  <div className="relative h-8 w-24">
                    <Image
                      src={branding.logo_url}
                      alt={branding.short_name}
                      fill
                      sizes="96px"
                      priority
                      className="object-contain object-left"
                    />
                  </div>
                ) : (
                  <span className="text-base font-extrabold font-fredoka bg-gradient-to-r from-[#468432] to-emerald-500 bg-clip-text text-transparent">
                    {branding.short_name}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Portal Wali Murid
                  </span>
                </div>
                {title && (
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 sm:hidden">
                    {title}
                  </p>
                )}
              </Link>
            </div>

            {/* Center: Desktop Navigation Tabs (Hidden on mobile) */}
            <nav className="hidden md:flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-800/60 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      item.active
                        ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Active Student Info, Print, Logout */}
            <div className="flex items-center gap-2.5">
              {studentName && (
                <div className="hidden lg:flex items-center gap-2 pl-3 pr-2 py-1 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/60 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs font-fredoka">
                    {studentName.charAt(0)}
                  </div>
                  <div className="text-left pr-1 leading-tight">
                    <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-[130px]">
                      {studentName}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {studentClass ? `Kelas ${studentClass}` : nisn ? `NISN ${nisn}` : "Santri Aktif"}
                    </p>
                  </div>
                </div>
              )}

              {/* Desktop Print button */}
              <button
                type="button"
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors shadow-2xs"
                title="Cetak Halaman ini"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-500" />
                <span className="hidden md:inline">Cetak</span>
              </button>

              {/* Logout button */}
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold text-rose-700 dark:text-rose-400 transition-colors cursor-pointer"
                title="Keluar dari Portal Wali Murid"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Phone viewport only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-2 py-1.5 flex justify-around items-center shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-semibold transition-all ${
                item.active
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${item.active ? "text-emerald-600 dark:text-emerald-400" : ""}`} />
              <span>{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout confirmation dialog */}
      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Keluar dari Portal Wali Murid?"
        description="Apakah Anda yakin ingin mengakhiri sesi pantauan perkembangan anak ini?"
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        variant="destructive"
        onConfirm={logout}
      />
    </>
  );
}

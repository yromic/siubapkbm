"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { User, LogOut, KeyRound, ChevronDown } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      {/* Topbar Minimalis */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-[#171717]/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto w-full">
          {/* Logo & School Name */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold bg-gradient-to-r from-[#468432] to-emerald-500 bg-clip-text text-transparent">
              SIUBA
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 font-semibold border border-zinc-200 dark:border-zinc-700">
              Portal
            </span>
          </div>

          {/* User Actions with DropdownMenu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all outline-none cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-emerald-50/200/10 text-[#468432] dark:text-emerald-450 flex items-center justify-center font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold leading-none">{user.name}</span>
                  <span className="text-[10px] text-zinc-500 mt-0.5">{user.role}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={5}
                className="z-50 min-w-[220px] bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 outline-none"
              >
                <div className="px-3 py-2 border-b border-zinc-150 dark:border-zinc-800 mb-1">
                  <p className="text-xs text-zinc-450 dark:text-zinc-500">Masuk sebagai</p>
                  <p className="text-sm font-bold truncate text-zinc-900 dark:text-zinc-100">{user.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                </div>

                <DropdownMenu.Item asChild>
                  <Link
                    href="/profile/change-password"
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-zinc-400" />
                    Ganti Password
                  </Link>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  onClick={() => setShowConfirmLogout(true)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-xs font-medium text-red-650 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 outline-none transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar dari Sistem
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <ConfirmDialog
        open={showConfirmLogout}
        onOpenChange={setShowConfirmLogout}
        title="Keluar dari Sistem?"
        description="Anda akan diarahkan ke halaman login. Pastikan semua pekerjaan Anda sudah tersimpan."
        confirmLabel="Ya, Keluar"
        variant="destructive"
        onConfirm={logout}
      />
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { BookOpen, Banknote, MapPin, ArrowRight } from "lucide-react";

export default function PortalPage() {
  const { user } = useAuth();

  if (!user) return null;

  interface ModuleItem {
    title: string;
    description: string;
    href: string;
    icon: React.ReactNode;
    allowedRoles: string[];
    badge: string;
    disabled?: boolean;
  }

  const modules: ModuleItem[] = [
    {
      title: "Modul Akademik",
      description: "Kelola kelas, nilai akademik siswa, dan rekapitulasi perkembangan karakter.",
      href: "/dashboard",
      icon: <BookOpen className="w-8 h-8 text-[#468432] dark:text-emerald-400" />,
      allowedRoles: ["administrator", "admin", "teacher"],
      badge: "Aktif",
    },
    {
      title: "Modul Keuangan",
      description: "Monitoring data pembayaran SPP siswa dan penyesuaian biaya tagihan bulanan.",
      href: "/finance",
      icon: <Banknote className="w-8 h-8 text-[#468432] dark:text-emerald-400" />,
      allowedRoles: ["administrator", "admin"],
      badge: "Aktif",
    },
    {
      title: "Modul Presensi",
      description: "Pencatatan kehadiran harian staff dan guru wali kelas berbasis geolocation.",
      href: "/presence",
      icon: <MapPin className="w-8 h-8 text-[#468432] dark:text-emerald-450" />,
      allowedRoles: ["administrator", "admin", "teacher"],
      badge: "Aktif",
    },
  ];

  // Filter modules based on user role
  const userModules = modules.filter(mod => mod.allowedRoles.includes(user.role));

  return (
    <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Selamat Datang, {user.name}
        </h1>
        <p className="mt-3 text-base text-zinc-650 dark:text-zinc-400 max-w-2xl mx-auto">
          Silakan pilih modul layanan di bawah ini untuk memulai aktivitas monitoring Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {userModules.map((mod) => {
          const CardContent = (
            <div
              className={`h-full flex flex-col justify-between p-6 rounded-[24px] border text-left transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                mod.disabled
                  ? "bg-zinc-50/50 dark:bg-[#171717]/10 border-zinc-200 dark:border-zinc-800 opacity-60 pointer-events-none"
                  : "bg-white dark:bg-[#171717] border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500/80 hover:shadow-lg hover:shadow-[#468432]/5 dark:hover:bg-zinc-850/50"
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-[20px] bg-emerald-50/20 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-900/30">
                    {mod.icon}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      mod.disabled
                        ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-250 dark:border-zinc-700 text-zinc-500"
                        : "bg-emerald-50/20 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900 text-[#468432] dark:text-emerald-450"
                    }`}
                  >
                    {mod.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                  {mod.title}
                </h3>
                <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              {!mod.disabled && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#468432] dark:text-emerald-450 mt-6 group">
                  <span>Masuk Modul</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </div>
          );

          if (mod.disabled) {
            return (
              <div key={mod.title} className="relative">
                {CardContent}
              </div>
            );
          }

          return (
            <Link key={mod.title} href={mod.href} className="no-underline outline-none">
              {CardContent}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

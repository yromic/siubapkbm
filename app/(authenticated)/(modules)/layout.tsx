"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ForbiddenState, LoadingState } from "@/components/ui-states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notify } from "@/lib/notify";
import {
  LayoutDashboard,
  Database,
  Users,
  BookOpen,
  GraduationCap,
  UserCog,
  School,
  ArrowLeftRight,
  Building2,
  CheckCircle,
  Heart,
  PieChart,
  FileText,
  Upload,
  Download,
  Clock,
  Banknote,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Menu,
  X,
  KeyRound,
  LogOut,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Layout,
} from "lucide-react";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  roles: ("administrator" | "admin" | "teacher")[];
  category: "utama" | "akademik" | "website" | "sistem" | "data";
}

const CATEGORIES = {
  utama: "Utama",
  akademik: "Akademik & Kelas",
  website: "Portal & Website CMS",
  sistem: "Administrasi & Keuangan",
  data: "Data & Integrasi",
};

const MENU_ITEMS: MenuItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    roles: ["administrator", "admin", "teacher"],
    category: "utama",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    name: "Kelas Saya",
    href: "/my-class",
    roles: ["teacher"],
    category: "utama",
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    name: "Nilai Akademik",
    href: "/academic-scores",
    roles: ["teacher"],
    category: "utama",
    icon: <CheckCircle className="w-5 h-5" />,
  },
  {
    name: "Budaya Harian",
    href: "/daily-culture",
    roles: ["teacher"],
    category: "utama",
    icon: <Heart className="w-5 h-5" />,
  },
  {
    name: "Rekap Karakter",
    href: "/character-recap",
    roles: ["teacher"],
    category: "utama",
    icon: <PieChart className="w-5 h-5" />,
  },
  {
    name: "Siswa",
    href: "/students",
    roles: ["administrator", "admin"],
    category: "akademik",
    icon: <Users className="w-5 h-5" />,
  },
  {
    name: "Guru",
    href: "/teachers",
    roles: ["administrator"],
    category: "akademik",
    icon: <GraduationCap className="w-5 h-5" />,
  },
  {
    name: "Kelas",
    href: "/classes",
    roles: ["administrator"],
    category: "akademik",
    icon: <School className="w-5 h-5" />,
  },
  {
    name: "Mata Pelajaran",
    href: "/subjects",
    roles: ["administrator"],
    category: "akademik",
    icon: <BookOpen className="w-5 h-5" />,
  },
  {
    name: "Mapel di Kelas",
    href: "/classes/subjects",
    roles: ["administrator"],
    category: "akademik",
    icon: <ArrowLeftRight className="w-5 h-5" />,
  },
  {
    name: "Kenaikan Kelas",
    href: "/settings/promotion",
    roles: ["administrator", "admin"],
    category: "akademik",
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    name: "Master Data",
    href: "/master-data",
    roles: ["administrator"],
    category: "sistem",
    icon: <Database className="w-5 h-5" />,
  },
  {
    name: "Pengguna",
    href: "/users",
    roles: ["administrator"],
    category: "sistem",
    icon: <UserCog className="w-5 h-5" />,
  },
  {
    name: "Keuangan (SPP)",
    href: "/finance",
    roles: ["administrator", "admin"],
    category: "sistem",
    icon: <Banknote className="w-5 h-5" />,
  },
  {
    name: "Salin Pengaturan",
    href: "/settings/rollover",
    roles: ["administrator", "admin"],
    category: "sistem",
    icon: <RefreshCw className="w-5 h-5" />,
  },
  {
    name: "Kelola Landing Page",
    href: "/settings/cms-landing",
    roles: ["administrator", "admin"],
    category: "website",
    icon: <Layout className="w-5 h-5" />,
  },
  {
    name: "Dokumen",
    href: "/documents",
    roles: ["admin"],
    category: "sistem",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    name: "Audit Log",
    href: "/audit-log",
    roles: ["administrator"],
    category: "sistem",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    name: "Pemeriksaan Sistem",
    href: "/health-check",
    roles: ["administrator", "admin"],
    category: "sistem",
    icon: <ShieldCheck className="w-5 h-5" />,
  },
  {
    name: "Design System",
    href: "/design-system",
    roles: ["administrator"],
    category: "sistem",
    icon: <Layout className="w-5 h-5" />,
  },
  {
    name: "Import",
    href: "/import",
    roles: ["administrator", "admin", "teacher"],
    category: "data",
    icon: <Upload className="w-5 h-5" />,
  },
  {
    name: "Export",
    href: "/export",
    roles: ["administrator", "admin", "teacher"],
    category: "data",
    icon: <Download className="w-5 h-5" />,
  },
];

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const handleConfirmLogout = async () => {
    setConfirmLogoutOpen(false);
    const toastId = notify.loading("Proses keluar...");
    try {
      await logout();
      notify.dismiss(toastId);
    } catch (err) {
      notify.dismiss(toastId);
      notify.error("Gagal mencabut sesi di server, mengakhiri sesi lokal...");
    }
  };

  // Accordion open/close state per category
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    utama: true,
    akademik: false,
    website: false,
    sistem: false,
    data: false,
  });

  const toggleCategory = (key: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return <LoadingState message="Memverifikasi akses..." />;
  }

  if (!user) {
    return null;
  }

  // Filter menu items for current user's role
  const userMenuItems = MENU_ITEMS.filter((item) => item.roles.includes(user.role));

  // Determine if user has access to current path
  const currentMenuItem = MENU_ITEMS.find((item) => {
    if (item.href === "/") return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  });
  const hasAccess = !currentMenuItem || currentMenuItem.roles.includes(user.role);

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case "administrator":
        return "Administrator";
      case "admin":
        return "Operator / Admin";
      case "teacher":
        return "Guru Wali Kelas";
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-50 font-sans">
      {/* Topbar - Header Section */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-[#171717]/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 rounded-[12px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-[#262626] md:hidden cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold bg-gradient-to-r from-[#468432] to-emerald-500 bg-clip-text text-transparent">
              SIUBA
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right mr-1">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{user.name}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatRoleLabel(user.role)}</span>
            </div>
            <Link
              href="/profile/change-password"
              className="flex items-center gap-2 px-3 py-1.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-[#262626] transition-colors text-zinc-700 dark:text-zinc-300"
            >
              <KeyRound className="w-4 h-4 text-zinc-400" />
              <span className="hidden sm:inline">Ganti Password</span>
            </Link>
            <button
              onClick={() => setConfirmLogoutOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-[#262626] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-500" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Desktop Sidebar - Surface 1 */}
        <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#171717] shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-hidden">
          <nav className="flex-1 overflow-y-auto space-y-4 px-3 py-6 pr-2">
            <Link
              href="/portal"
              className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-[12px] text-sm font-semibold transition-all border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
              Kembali ke Portal
            </Link>

            {Object.entries(CATEGORIES).map(([catKey, catName]) => {
              const items = userMenuItems.filter((item) => item.category === catKey);
              if (items.length === 0) return null;

              const isOpen = openCategories[catKey];

              return (
                <div key={catKey} className="space-y-1.5 pt-3 first:pt-0 border-t first:border-t-0 border-zinc-100 dark:border-zinc-800">
                  {/* Category Header Button */}
                  <button
                    onClick={() => toggleCategory(catKey)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:bg-zinc-100/60 dark:hover:bg-[#262626]/40 rounded-[12px] transition-all text-left cursor-pointer select-none"
                  >
                    <span>{catName}</span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </button>

                  {/* Collapsible Content */}
                  {isOpen && (
                    <div className="space-y-1 animate-fadeIn">
                      {items.map((item) => {
                        const active =
                          pathname === item.href ||
                          (pathname.startsWith(`${item.href}/`) &&
                            !userMenuItems.some(
                              (other) =>
                                other.href !== item.href &&
                                other.href.startsWith(item.href) &&
                                pathname.startsWith(other.href)
                            ));
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-[12px] text-sm font-medium transition-all ${active
                              ? "bg-emerald-50/60 dark:bg-emerald-950/20 text-[#468432] dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-950/20"
                              : "text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-zinc-200"
                              }`}
                          >
                            <span className={active ? "text-[#468432] dark:text-emerald-400" : "text-zinc-400"}>
                              {item.icon}
                            </span>
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Sidebar Footer Copyright & Developer Brand */}
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-450 dark:text-zinc-500 font-medium space-y-1 select-none">
            <div>&copy; {new Date().getFullYear()} SIUBA.</div>
            <div>
              Developed by{" "}
              <span className="font-semibold text-brand-emerald-600 dark:text-emerald-500">
                IKDevworks
              </span>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden bg-zinc-900/40 backdrop-blur-sm">
            <div className="w-72 bg-white dark:bg-[#171717] p-6 flex flex-col h-full border-r border-zinc-200 dark:border-zinc-800 animate-fadeIn">
              <div className="flex items-center justify-between pb-6 border-b border-zinc-100 dark:border-zinc-800 mb-6">
                <div>
                  <h3 className="font-bold text-zinc-950 dark:text-zinc-50">{user.name}</h3>
                  <p className="text-xs text-zinc-500 mb-2">{formatRoleLabel(user.role)}</p>
                  <Link
                    href="/profile/change-password"
                    onClick={() => setSidebarOpen(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#468432] dark:text-emerald-400 hover:underline"
                  >
                    <KeyRound className="w-4 h-4" />
                    Ganti Password
                  </Link>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded-[12px] hover:bg-zinc-100 dark:hover:bg-[#262626]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Scrollable Mobile Nav */}
              <nav className="flex-1 overflow-y-auto space-y-4 pr-1">
                <Link
                  href="/portal"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-[12px] text-sm font-semibold transition-all border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-[#262626] text-zinc-700 dark:text-zinc-300"
                >
                  <ArrowLeft className="w-5 h-5 text-zinc-400" />
                  Kembali ke Portal
                </Link>

                {Object.entries(CATEGORIES).map(([catKey, catName]) => {
                  const items = userMenuItems.filter((item) => item.category === catKey);
                  if (items.length === 0) return null;

                  const isOpen = openCategories[catKey];

                  return (
                    <div key={catKey} className="space-y-1.5 pt-3 first:pt-0 border-t first:border-t-0 border-zinc-100 dark:border-zinc-800">
                      {/* Mobile Category Header Button */}
                      <button
                        onClick={() => toggleCategory(catKey)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:bg-zinc-100/60 dark:hover:bg-[#262626]/40 rounded-[12px] transition-all text-left cursor-pointer select-none"
                      >
                        <span>{catName}</span>
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </button>

                      {/* Mobile Collapsible Content */}
                      {isOpen && (
                        <div className="space-y-1 animate-fadeIn">
                          {items.map((item) => {
                            const active =
                              pathname === item.href ||
                              (pathname.startsWith(`${item.href}/`) &&
                                !userMenuItems.some(
                                  (other) =>
                                    other.href !== item.href &&
                                    other.href.startsWith(item.href) &&
                                    pathname.startsWith(other.href)
                                ));
                            return (
                              <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-[12px] text-sm font-medium transition-all ${active
                                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 text-[#468432] dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-950/20"
                                  : "text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#262626] hover:text-zinc-900 dark:hover:text-zinc-200"
                                  }`}
                              >
                                <span className={active ? "text-[#468432] dark:text-emerald-400" : "text-zinc-400"}>
                                  {item.icon}
                                </span>
                                {item.name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>

              {/* Mobile Sidebar Footer */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-450 dark:text-zinc-500 font-medium space-y-1 select-none">
                <div>&copy; {new Date().getFullYear()} SIUBA.</div>
                <div>
                  Developed by{" "}
                  <span className="font-semibold text-brand-emerald-600 dark:text-emerald-500">
                    IKDevworks
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1" onClick={() => setSidebarOpen(false)}></div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 flex flex-col">
            {hasAccess ? (
              children
            ) : (
              <ForbiddenState message="Role Anda tidak memiliki otorisasi untuk mengakses menu ini." />
            )}
          </div>
        </main>
      </div>

      {/* Bottom Navigation Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#171717]/95 backdrop-blur-md md:hidden flex justify-around items-center px-2">
        {userMenuItems.slice(0, 4).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-semibold transition-colors ${active ? "text-[#468432] dark:text-emerald-400" : "text-zinc-500 hover:text-zinc-700"
                }`}
            >
              <span className={`mb-0.5 ${active ? "text-[#468432] dark:text-emerald-400" : "text-zinc-400"}`}>
                {item.icon}
              </span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Konfirmasi Logout */}
      <ConfirmDialog
        open={confirmLogoutOpen}
        onOpenChange={setConfirmLogoutOpen}
        title="Keluar dari Sistem?"
        description="Anda akan diarahkan ke halaman login. Pastikan semua pekerjaan sudah tersimpan sebelum keluar."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        variant="destructive"
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
}

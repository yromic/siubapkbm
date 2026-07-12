"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ParentAuthProvider, useParentAuth } from "@/hooks/useParentAuth";
import { LoadingState } from "@/components/ui-states";

function ParentRouteGuard({ children }: { children: React.ReactNode }) {
  const { token, loading } = useParentAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isLoginRoute = pathname === "/parent/login";
    const isProtectedRoute = pathname === "/parent/dashboard" || pathname === "/parent/character" || pathname === "/parent/academic";

    if (!token && isProtectedRoute) {
      // Redirect unauthenticated parents trying to access dashboard, character, or academic detail to login
      router.push("/parent/login");
    } else if (token && isLoginRoute) {
      // Redirect already authenticated parents trying to access login page to dashboard
      router.push("/parent/dashboard");
    }
  }, [token, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#0a0a0a]">
        <LoadingState message="Memuat sesi orang tua..." />
      </div>
    );
  }

  // Handle path authorization block during render to avoid content flash
  const isProtectedRoute = pathname === "/parent/dashboard" || pathname === "/parent/character" || pathname === "/parent/academic";
  if (!token && isProtectedRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#0a0a0a]">
        <LoadingState message="Mengarahkan ke halaman login..." />
      </div>
    );
  }

  const isLoginRoute = pathname === "/parent/login";
  if (token && isLoginRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#0a0a0a]">
        <LoadingState message="Mengarahkan ke dashboard..." />
      </div>
    );
  }

  return <>{children}</>;
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParentAuthProvider>
      <ParentRouteGuard>{children}</ParentRouteGuard>
    </ParentAuthProvider>
  );
}

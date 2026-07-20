"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "./ui-states";
import LandingLoadingScreen from "./landing/LandingLoadingScreen";
import { isPublicRoute as checkIsPublicRoute } from "@/lib/routes";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isAuthRoute = pathname === "/login";
    const isPublicRoute = checkIsPublicRoute(pathname);

    if (!user && !isAuthRoute && !isPublicRoute) {
      // Direct unauthenticated users to login
      router.push("/login");
    } else if (user && isAuthRoute) {
      // Direct authenticated users away from login
      router.push("/portal");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    // Landing page gets a fun, branded loading screen instead of the generic spinner
    if (pathname === "/") {
      return <LandingLoadingScreen />;
    }
    return <LoadingState message="Memuat sesi autentikasi..." />;
  }

  return <>{children}</>;
}

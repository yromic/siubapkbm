"use client";

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/ui-states";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Memverifikasi akses..." />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

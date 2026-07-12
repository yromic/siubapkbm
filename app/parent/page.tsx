"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParentAuth } from "@/hooks/useParentAuth";
import { LoadingState } from "@/components/ui-states";

export default function ParentIndexPage() {
  const { token, loading } = useParentAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (token) {
      router.push("/parent/dashboard");
    } else {
      router.push("/parent/login");
    }
  }, [token, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#0a0a0a]">
      <LoadingState message="Mengarahkan..." />
    </div>
  );
}

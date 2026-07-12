"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ParentProfile, loginParentApi, logoutParentApi, getParentProfileApi } from "@/lib/api/parent";
import { ApiError } from "@/lib/api/client";

interface ParentAuthContextType {
  profile: ParentProfile | null;
  token: string | null;
  loading: boolean;
  login: (nisn: string, birth_date: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearSession: () => void;
}

const ParentAuthContext = createContext<ParentAuthContextType | undefined>(undefined);

export function ParentAuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const clearSession = useCallback(() => {
    setToken(null);
    setProfile(null);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await getParentProfileApi("");
      setProfile(data);
      setToken("cookie_session");
      if (typeof window !== "undefined" && window.location.pathname === "/parent/login") {
        router.push("/parent/dashboard");
      }
    } catch (error) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/parent/login") {
        router.push("/parent/login?expired=true");
      }
    } finally {
      setLoading(false);
    }
  }, [clearSession, router]);

  // Load session on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname !== "/parent/login") {
      refreshProfile();
    } else {
      setLoading(false);
    }
  }, [refreshProfile]);

  const login = async (nisn: string, birth_date: string, pin: string) => {
    setLoading(true);
    try {
      await loginParentApi(nisn, birth_date, pin);
      setToken("cookie_session");
      
      // Fetch full whitelist-safe profile details
      const prof = await getParentProfileApi("");
      setProfile(prof);
      router.push("/parent/dashboard");
    } catch (error) {
      clearSession();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutParentApi("");
    } catch (error) {
      console.error("Failed to revoke parent session on server:", error);
    }
    clearSession();
    router.push("/parent/login");
  };

  return (
    <ParentAuthContext.Provider
      value={{
        profile,
        token,
        loading,
        login,
        logout,
        refreshProfile,
        clearSession,
      }}
    >
      {children}
    </ParentAuthContext.Provider>
  );
}

export function useParentAuth() {
  const context = useContext(ParentAuthContext);
  if (context === undefined) {
    throw new Error("useParentAuth must be used within a ParentAuthProvider");
  }
  return context;
}

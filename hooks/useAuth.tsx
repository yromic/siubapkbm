"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StaffUser, LoginResponse, CurrentUserResponse, apiRequest, ApiError } from "@/lib/api/client";
import { isPublicRoute } from "@/lib/routes";

interface AuthContextType {
  user: StaffUser | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const data = await apiRequest<CurrentUserResponse>("get_current_user", {});
      setUser(data.user);
      setToken("cookie_session");
      if (typeof window !== "undefined" && window.location.pathname === "/login") {
        router.push("/portal");
      }
    } catch (error) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        const isPublic = isPublicRoute(window.location.pathname);
        if (!isPublic) {
          router.push("/login?expired=true");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [clearSession, router]);

  // Load session on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      refreshCurrentUser();
    } else {
      setLoading(false);
    }
  }, [refreshCurrentUser]);

  const login = async (identifier: string, password: string) => {
    try {
      const data = await apiRequest<LoginResponse>("login", { identifier, password });
      setToken("cookie_session");
      setUser(data.user);
      router.push("/portal");
    } catch (error) {
      clearSession();
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiRequest<{ revoked: boolean }>("logout", {});
    } catch (error) {
      console.error("Failed to revoke session on server:", error);
    }
    clearSession();
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        refreshCurrentUser,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

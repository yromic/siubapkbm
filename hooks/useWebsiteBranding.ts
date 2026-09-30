"use client";

import { useState, useEffect } from "react";

export interface WebsiteBranding {
  school_name: string;
  short_name: string;
  tagline: string;
  logo_url: string | null;
}

let cachedBranding: WebsiteBranding | null = null;

export function useWebsiteBranding() {
  const [branding, setBranding] = useState<WebsiteBranding>(
    cachedBranding || {
      school_name: "SIUBA (Paket A PKBM Baitusyukur Learning Center)",
      short_name: "SIUBA",
      tagline: "Sekolah Dasar Alternatif Pilihan Utama",
      logo_url: null,
    }
  );
  const [loading, setLoading] = useState(!cachedBranding);

  useEffect(() => {
    if (cachedBranding) return;

    let mounted = true;
    fetch("/api/v1/config")
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.data) {
          const b: WebsiteBranding = {
            school_name: json.data.school_name || "SIUBA",
            short_name: json.data.short_name || "SIUBA",
            tagline: json.data.tagline || "",
            logo_url: json.data.logo?.url || null,
          };
          cachedBranding = b;
          setBranding(b);
        }
      })
      .catch((err) => {
        console.error("Failed to load CMS branding:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { branding, loading };
}

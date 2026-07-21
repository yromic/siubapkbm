import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans, Fredoka, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/hooks/useSettings";
import { RouteGuard } from "@/components/route-guard";
import { SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

import { getWebsiteConfig } from "@/lib/services/websiteConfigService";

export async function generateViewport() {
  try {
    const config = await getWebsiteConfig();
    return {
      themeColor: config.theme_branding?.primary_color || "#10b981",
      colorScheme: "light dark",
      width: "device-width",
      initialScale: 1,
    };
  } catch (error) {
    return {
      themeColor: "#10b981",
      colorScheme: "light dark",
      width: "device-width",
      initialScale: 1,
    };
  }
}

export async function generateMetadata() {
  try {
    const config = await getWebsiteConfig();
    const title = `${config.school_name} - ${config.tagline}`;
    const description = config.seo_defaults?.default_description || config.tagline;
    const logoUrl = config.logo?.url || "/favicon.ico";
    const canonical = config.seo_defaults?.canonical_base_url || "https://siuba.sch.id";
    
    return {
      metadataBase: new URL(canonical),
      title: {
        default: title,
        template: `%s | ${config.short_name}`,
      },
      description,
      keywords: config.seo_defaults?.default_keywords || [],
      applicationName: config.short_name,
      authors: [{ name: config.school_name, url: canonical }],
      creator: config.school_name,
      publisher: config.school_name,
      category: "education",
      formatDetection: {
        email: false,
        address: false,
        telephone: false,
      },
      icons: {
        icon: config.favicon?.url || "/favicon.ico",
        apple: config.favicon?.url || "/favicon.ico",
      },
      openGraph: {
        title,
        description,
        url: canonical,
        siteName: config.school_name,
        images: [
          {
            url: config.seo_defaults?.default_og_image || logoUrl,
            alt: config.school_name,
          },
        ],
        locale: "id_ID",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [config.seo_defaults?.default_og_image || logoUrl],
      },
      alternates: {
        canonical,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
    };
  } catch (error) {
    return {
      metadataBase: new URL("https://siuba.sch.id"),
      title: "SIUBA - Sekolah Dasar Alternatif",
      description: "Pendidikan dasar kesetaraan berbasis adab Islami",
      robots: {
        index: true,
        follow: true,
      },
    };
  }
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexSans.variable} ${fredoka.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
        <AuthProvider>
          <SettingsProvider>
            <RouteGuard>
              {children}
            </RouteGuard>
          </SettingsProvider>
        </AuthProvider>
        {/* Global toast provider — toasts triggered via lib/notify.ts */}
        <SonnerToaster />
      </body>
    </html>
  );
}

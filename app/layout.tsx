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

export const metadata: Metadata = {
  metadataBase: new URL("https://siuba.sch.id"),
  title: "SIUBA Akademik & Karakter",
  description: "Sistem Informasi Monitoring Akademik dan Karakter Siswa PKBM",
  robots: {
    index: true,
    follow: true,
  },
};

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

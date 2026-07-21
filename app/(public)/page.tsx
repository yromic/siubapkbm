import React from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { getWebsiteConfig, WebsiteConfig } from "@/lib/services/websiteConfigService";
import { getNavigationMenu } from "@/lib/services/navigationService";
import { getActiveSections, Section } from "@/lib/services/sectionService";
import { ComponentRegistry } from "@/components/landing/registry";

// Next.js dynamic rendering since it relies on DB configuration
export const dynamic = "force-dynamic";

export default async function PublicLandingPage({ searchParams }: { searchParams?: Promise<{ preview?: string }> }) {
  let config: WebsiteConfig | null = null;
  let navbarMenu;
  let footerMenu;
  let sections: Section[] = [];
  
  const resolvedSearchParams = await searchParams;
  const isPreview = resolvedSearchParams?.preview === "true";
  
  try {
    config = await getWebsiteConfig();
    navbarMenu = await getNavigationMenu("navbar");
    footerMenu = await getNavigationMenu("footer");
    sections = await getActiveSections(isPreview);
  } catch (error) {
    console.error("Error retrieving website config or sections:", error);
  }

  // Fallback defaults if DB call completely fails
  const schoolName = config?.school_name || "SIUBA (Paket A PKBM Baitusyukur Learning Center)";
  const shortName = config?.short_name || "SIUBA";
  const tagline = config?.tagline || "Sekolah Dasar Alternatif Pilihan Utama dengan kurikulum esensial bebas tekanan dan penanaman adab Islami berlandaskan sunnah.";
  const canonicalUrl = config?.seo_defaults?.canonical_base_url || "https://siuba.sch.id";
  const phoneRaw = config?.contact_phone_raw || "+6289655496283";
  const email = config?.contact_email || "pkbmpaketasiuba@gmail.com";
  const logoUrl = config?.logo?.url || `${canonicalUrl}/favicon.ico`;
  const principalPhotoUrl = config?.principal_photo?.url || `${canonicalUrl}/images/principal/principal.jpg`;

  // Structured JSON-LD Data for SEO (WebSite, EducationalOrganization, and BreadcrumbList)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${canonicalUrl}/#website`,
        "url": canonicalUrl,
        "name": schoolName,
        "description": tagline,
        "publisher": {
          "@id": `${canonicalUrl}/#organization`
        },
        "inLanguage": "id"
      },
      {
        "@type": "EducationalOrganization",
        "@id": `${canonicalUrl}/#organization`,
        "name": schoolName,
        "alternateName": shortName,
        "url": canonicalUrl,
        "logo": {
          "@type": "ImageObject",
          "url": logoUrl,
          "caption": schoolName
        },
        "image": {
          "@type": "ImageObject",
          "url": principalPhotoUrl,
          "caption": `${schoolName} Principal`
        },
        "description": tagline,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": config?.address_street || "Jl. Letjend Suprapto, Putotan, Sidomulyo",
          "addressLocality": config?.address_district || "Kecamatan Ungaran Timur",
          "addressRegion": config?.address_regency || "Kabupaten Semarang",
          "postalCode": config?.address_postal_code || "50514",
          "addressCountry": "ID"
        },
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": phoneRaw,
          "contactType": "customer service",
          "email": email,
          "availableLanguage": ["id", "en"]
        },
        "sameAs": config?.social_media ? Object.values(config.social_media).filter(Boolean) : []
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}/#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Beranda",
            "item": canonicalUrl
          }
        ]
      }
    ]
  };

  return (
    <div className="min-h-screen bg-background text-zinc-900 dark:text-zinc-50 font-plus-jakarta selection:bg-brand-emerald-500/20 selection:text-brand-emerald-700">
      {/* JSON-LD injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Floating Navbar */}
      <Navbar menuItems={navbarMenu?.links} shortName={shortName} logoUrl={config?.logo?.url} />

      {/* Main Sections */}
      <main>
        {sections.length > 0 ? (
          sections.map((section) => {
            const Component = ComponentRegistry[section.type];
            if (!Component) return null;
            return (
              <Component
                key={section.id}
                title={section.title}
                subtitle={section.subtitle}
                badge={section.badge}
                content={section.content}
                items={section.items}
                config={section.type === "principal" ? config : undefined}
              />
            );
          })
        ) : (
          /* Static hardcoded fallback elements if no database content exists */
          <>
            {/* Fallback references just render static components directly */}
            {Object.values(ComponentRegistry).map((Component, index) => (
              <Component key={index} />
            ))}
          </>
        )}
      </main>

      {/* Footer */}
      <Footer config={config || undefined} footerMenuItems={footerMenu?.links} />
    </div>
  );
}

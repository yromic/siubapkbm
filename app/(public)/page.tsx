import React from "react";
import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import About from "@/components/landing/About";
import Programs from "@/components/landing/Programs";
import SchoolLife from "@/components/landing/SchoolLife";
import Gallery from "@/components/landing/Gallery";
import Achievements from "@/components/landing/Achievements";
import Testimonials from "@/components/landing/Testimonials";
import Principal from "@/components/landing/Principal";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "SIUBA - Sekolah Dasar Alternatif Pilihan Utama",
  description: "Pendidikan dasar kesetaraan (Paket A) berbasis adab Islami di bawah lingkungan belajar minimalis yang aman secara psikologis. Resmi dan diakui negara.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SIUBA - Sekolah Dasar Alternatif Pilihan Utama",
    description: "Menumbuhkan fitrah anak secara utuh dan tangguh di bawah bimbingan tutor berkompeten dengan kurikulum esensial bebas tekanan.",
    url: "https://siuba.sch.id",
    siteName: "SIUBA",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/images/activities/activity-1.webp",
        width: 1200,
        height: 900,
        alt: "Aktivitas Belajar SIUBA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SIUBA - Sekolah Dasar Alternatif Pilihan Utama",
    description: "Pendidikan dasar kesetaraan (Paket A) berbasis adab Islami di bawah lingkungan belajar minimalis yang aman secara psikologis.",
    images: ["/images/activities/activity-1.webp"],
  },
};

export default function PublicLandingPage() {
  // Structured JSON-LD Data for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "School",
    "name": "SIUBA (Paket A PKBM Baitusyukur Learning Center)",
    "description": "Sekolah Dasar Alternatif Pilihan Utama dengan kurikulum esensial bebas tekanan dan penanaman adab Islami berlandaskan sunnah.",
    "url": "https://siuba.sch.id",
    "telephone": "+6289655496283",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Jl. Letjend Suprapto, Putotan, Sidomulyo",
      "addressLocality": "Kabupaten Semarang",
      "addressRegion": "Kecamatan Ungaran Timur",
      "postalCode": "50514",
      "addressCountry": "ID"
    },
    "openingHours": "Mo-Fr 07:00-15:30",
    "image": "https://siuba.sch.id/images/principal/principal.jpg"
  };

  return (
    <div className="min-h-screen bg-background text-zinc-900 dark:text-zinc-50 font-plus-jakarta selection:bg-brand-emerald-500/20 selection:text-brand-emerald-700">
      {/* JSON-LD injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Floating Navbar */}
      <Navbar />

      {/* Main Sections */}
      <main>
        {/* Hero Section */}
        <Hero />

        {/* Why Choose Us */}
        <WhyChooseUs />

        {/* About School */}
        <About />

        {/* Featured Programs */}
        <Programs />

        {/* School Life Storytelling */}
        <SchoolLife />

        {/* Dynamic Gallery */}
        <Gallery />

        {/* Achievements Card Grid */}
        <Achievements />

        {/* Testimonials Carousel */}
        <Testimonials />

        {/* Principal Greeting */}
        <Principal />

        {/* Collapsible FAQ Accordion */}
        <FAQ />

        {/* Call to Action */}
        <CTA />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

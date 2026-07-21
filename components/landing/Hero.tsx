"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Play } from "lucide-react";



interface HeroProps {
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  content?: any;
  items?: Array<{
    id?: string;
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    image?: { url: string; alt: string } | null;
    sort_order?: number;
  }>;
}


export default function Hero({ title, subtitle, badge, content, items }: HeroProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Images exclusively from CMS section items; empty if no DB data configured yet
  const activeImages = items && items.length > 0
    ? items.map(item => item.image?.url).filter(Boolean) as string[]
    : [];

  useEffect(() => {
    if (activeImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % activeImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [activeImages]);

  // All display values from CMS props; empty string fallback prevents crashes
  const displayBadge = badge || "";
  const displayTitle = title || "";
  const displaySubtitle = subtitle || "";

  const ctaText = content?.cta_text || "";
  const ctaUrl = content?.cta_url || "#";
  const videoText = content?.video_text || "";
  const videoUrl = content?.video_url || "#";

  return (
    <section id="beranda" className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-brand-cream py-20">
      {/* Background Slideshow — only rendered when CMS has configured images */}
      {activeImages.length > 0 && (
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full"
            >
              <Image
                src={activeImages[currentSlide]}
                alt={`Hero Background ${currentSlide + 1}`}
                fill
                sizes="100vw"
                priority
                unoptimized
                className="object-cover"
              />
            </motion.div>
          </AnimatePresence>
          {/* Soft emerald transparent gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-emerald-700/80 via-brand-emerald-600/50 to-brand-lime-600/30 mix-blend-multiply" />
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}

      {/* Floating Islamic Doodles / Geometric Shapes */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        {/* Crescent Moon */}
        <motion.div
          animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-28 left-[10%] text-white/20 hidden md:block"
        >
          <svg className="w-16 h-16 fill-current" viewBox="0 0 24 24">
            <path d="M12 3a9 9 0 1 0 9 9 9.003 9.003 0 0 1-9-9z" />
          </svg>
        </motion.div>

        {/* Islamic Star Pattern 1 */}
        <motion.div
          animate={{ y: [0, 12, 0], rotate: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-1/3 right-[12%] text-white/15 hidden md:block"
        >
          <svg className="w-20 h-20 fill-current" viewBox="0 0 24 24">
            <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
          </svg>
        </motion.div>

        {/* Octagram Star */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 45, 90] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-28 left-[15%] text-white/20 hidden md:block"
        >
          <svg className="w-12 h-12 fill-current" viewBox="0 0 24 24">
            <path d="M12 0l3 5h5l-3 3 3 5h-5l-3 3-3-3h-5l3-5-3-5h5z" />
          </svg>
        </motion.div>
      </div>

      {/* Hero Content */}
      <div className="relative z-20 max-w-5xl mx-auto px-6 text-center text-white mt-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
            <Sparkles className="w-4 h-4 text-brand-lime-500" />
            <span className="font-plus-jakarta text-xs md:text-sm font-bold tracking-wider uppercase text-brand-lime-100">
              {displayBadge}
            </span>
          </div>

          <h1 className="font-fredoka text-4xl md:text-6xl lg:text-7xl font-bold leading-tight max-w-4xl mx-auto drop-shadow-md">
            {displayTitle}
          </h1>

          <p className="font-plus-jakarta text-base md:text-xl text-zinc-100 max-w-2xl mx-auto font-medium drop-shadow-sm leading-relaxed">
            {displaySubtitle}
          </p>

          {(ctaText || videoText) && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
              {ctaText && (
                <Link
                  href={ctaUrl}
                  aria-label={ctaText}
                  className="font-plus-jakarta flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-brand-emerald-500 hover:bg-brand-emerald-600 active:bg-brand-emerald-700 text-white font-bold text-base shadow-lg shadow-brand-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer w-full sm:w-auto"
                >
                  {ctaText}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              )}
              {videoText && (
                <Link
                  href={videoUrl}
                  aria-label={videoText}
                  className="font-plus-jakarta flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white/15 hover:bg-white/25 active:bg-white/35 text-white font-bold text-base border border-white/20 backdrop-blur-sm shadow-md transition-all transform hover:-translate-y-0.5 cursor-pointer w-full sm:w-auto"
                >
                  <Play className="w-4 h-4 fill-white" />
                  {videoText}
                </Link>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Wave bottom decoration */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <svg className="w-full fill-brand-cream" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,32L80,37.3C160,43,320,53,480,53.3C640,53,800,43,960,37.3C1120,32,1280,32,1360,32L1440,32L1440,80L1360,80C1280,80,1120,80,960,80C800,80,640,80,480,80C320,80,160,80,80,80L0,80Z" />
        </svg>
      </div>
    </section>
  );
}

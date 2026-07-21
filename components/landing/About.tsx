"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star } from "lucide-react";



interface AboutProps {
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  items?: Array<{
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
  }>;
  content?: any;
}

export default function About({ title, subtitle, badge, items, content }: AboutProps) {
  // All display values from CMS props only
  const displayBadge = badge || "";
  const displayTitle = title || "";
  
  // Description from CMS subtitle or content.description
  const displayDesc = subtitle || content?.description || "";

  // Items (trust metrics) exclusively from CMS; empty array = no metrics rendered
  const activeItems = items && items.length > 0 ? items : [];
  
  // Main image from CMS content; empty string if not configured
  const mainImageUrl = content?.image?.url || content?.image_url || "";

  // Accreditation badge fields from CMS content
  const accTitle = content?.accreditation_title || "";
  const accSubtitle = content?.accreditation_subtitle || "";

  return (
    <section id="tentang" className="w-full py-24 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* Large Image Left */}
          <div className="lg:col-span-6 relative">
            {mainImageUrl && (
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="relative rounded-[24px] overflow-hidden border border-zinc-200/50 shadow-lg aspect-4/3 lg:aspect-square"
              >
                <Image
                  src={mainImageUrl}
                  alt={displayTitle}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 hover:scale-102"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-emerald-900/40 via-transparent to-transparent pointer-events-none" />
              </motion.div>
            )}

            {/* Small Organic Floating Badge */}
            {accTitle && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="absolute -bottom-6 -right-4 bg-brand-lime-500 text-white p-6 rounded-[20px] shadow-lg hidden sm:block border border-brand-lime-400 z-10"
              >
                <div className="flex items-center gap-3">
                  <Star className="w-8 h-8 fill-white animate-pulse" />
                  <div>
                    <h4 className="font-fredoka font-bold text-lg leading-none">{accTitle}</h4>
                    {accSubtitle && (
                      <p className="font-plus-jakarta text-xs text-white/90 mt-1">{accSubtitle}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Description Right */}
          <div className="lg:col-span-6 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <span className="font-plus-jakarta text-xs md:text-sm font-bold text-brand-emerald-600 uppercase tracking-widest bg-brand-emerald-50 dark:bg-brand-emerald-950/30 px-3 py-1.5 rounded-full inline-block">
                {displayBadge}
              </span>
              <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150 leading-tight">
                {displayTitle}
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="font-plus-jakarta text-zinc-600 dark:text-zinc-400 space-y-4 text-base md:text-lg leading-relaxed whitespace-pre-line"
            >
              {displayDesc}
            </motion.div>

            {/* Quick stats checklist / Trust Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="space-y-6 pt-4 border-t border-zinc-100 dark:border-zinc-800"
            >
              {activeItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="text-2xl font-bold text-brand-emerald-600 font-fredoka min-w-16">
                    {item.title}
                  </div>
                  <div>
                    <h4 className="font-fredoka text-base font-bold text-zinc-800 dark:text-zinc-200">
                      {item.subtitle}
                    </h4>
                    <p className="font-plus-jakarta text-xs text-zinc-550 dark:text-zinc-400 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}

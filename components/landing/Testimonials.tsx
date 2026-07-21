"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

interface TestimonialItem {
  id?: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  image?: { url: string; alt: string } | null | string;
  image_url?: string;
}



interface TestimonialsProps {
  title?: string | null;
  badge?: string | null;
  items?: TestimonialItem[];
}

export default function Testimonials({ title, badge, items }: TestimonialsProps) {
  const [current, setCurrent] = useState(0);

  // All display values from CMS props only
  const displayBadge = badge || "";
  const displayTitle = title || "";

  // Testimonials exclusively from CMS; empty = section not rendered
  const activeTestimonials = items && items.length > 0 ? items : [];

  const prev = () => {
    setCurrent((prevVal) => (prevVal === 0 ? activeTestimonials.length - 1 : prevVal - 1));
  };

  const next = () => {
    setCurrent((prevVal) => (prevVal === activeTestimonials.length - 1 ? 0 : prevVal + 1));
  };

  if (activeTestimonials.length === 0) return null;

  const currentItem = activeTestimonials[current];
  const avatarUrl = currentItem.image && typeof currentItem.image === "object"
    ? currentItem.image.url
    : (currentItem.image_url || (currentItem as any).image as string);

  return (
    <section className="w-full py-24 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="font-plus-jakarta text-xs md:text-sm font-bold text-brand-emerald-600 uppercase tracking-widest bg-brand-emerald-50 dark:bg-brand-emerald-950/30 px-3 py-1.5 rounded-full inline-block">
            {displayBadge}
          </span>
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            {displayTitle}
          </h2>
        </div>

        {/* Carousel Area */}
        <div className="relative p-8 md:p-12 rounded-[32px] bg-surface-1 border border-zinc-200/50 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-8 items-center">
          
          {/* Quote Icon Overlay */}
          <div className="absolute top-6 right-8 text-brand-emerald-500/10 pointer-events-none">
            <Quote className="w-24 h-24 stroke-[4]" />
          </div>

          {/* Parent Image */}
          <div className="w-28 h-28 md:w-36 md:h-36 relative rounded-full overflow-hidden border-4 border-white shadow-md flex-shrink-0 bg-zinc-100 dark:bg-zinc-800">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={currentItem.title || "Foto Wali Murid"}
                    fill
                    sizes="144px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-brand-emerald-100 dark:bg-brand-emerald-950/30 text-brand-emerald-600 font-fredoka text-2xl font-bold">
                    {(currentItem.title || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Testimonial Text */}
          <div className="flex-1 space-y-6 text-center md:text-left relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <p className="font-plus-jakarta text-zinc-650 dark:text-zinc-350 text-lg italic md:text-xl leading-relaxed">
                  &ldquo;{currentItem.description}&rdquo;
                </p>
                <div>
                  <h4 className="font-fredoka text-xl font-bold text-zinc-800 dark:text-zinc-200">
                    {currentItem.title}
                  </h4>
                  {currentItem.subtitle && (
                    <span className="font-plus-jakarta text-xs font-bold text-brand-emerald-600 uppercase tracking-wider">
                      {currentItem.subtitle}
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Controls */}
            {activeTestimonials.length > 1 && (
              <div className="flex items-center justify-center md:justify-start gap-4">
                <button
                  onClick={prev}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-1 border border-zinc-200/60 dark:border-zinc-800 text-zinc-700 dark:text-zinc-350 hover:bg-brand-emerald-50 dark:hover:bg-brand-emerald-950/30 hover:text-brand-emerald-600 dark:hover:text-brand-emerald-500 transition-colors shadow-sm cursor-pointer"
                  aria-label="Testimoni sebelumnya"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={next}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-1 border border-zinc-200/60 dark:border-zinc-800 text-zinc-700 dark:text-zinc-350 hover:bg-brand-emerald-50 dark:hover:bg-brand-emerald-950/30 hover:text-brand-emerald-600 dark:hover:text-brand-emerald-500 transition-colors shadow-sm cursor-pointer"
                  aria-label="Testimoni selanjutnya"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </section>
  );
}

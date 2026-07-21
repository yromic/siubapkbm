"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface GalleryItem {
  id?: string;
  title?: string | null;
  description?: string | null;
  image?: { url: string; alt: string } | null | string;
  custom_fields?: any;
  image_url?: string;
  category?: string;
}



interface GalleryProps {
  title?: string | null;
  subtitle?: string | null;
  items?: GalleryItem[];
}

export default function Gallery({ title, subtitle, items }: GalleryProps) {
  const [activeCategory, setActiveCategory] = useState("Semua");

  // All display values from CMS props only
  const displayTitle = title || "";
  const displaySubtitle = subtitle || "";

  // Items exclusively from CMS; empty = no masonry grid rendered (no crash)
  const activeItems = items && items.length > 0 ? items : [];

  // Extract category names dynamically from items
  const itemCategories = activeItems.map(item => {
    if (item.category) return item.category;
    if (item.custom_fields) {
      try {
        const parsed = typeof item.custom_fields === "string" ? JSON.parse(item.custom_fields) : item.custom_fields;
        return parsed.category || parsed.tag || "Lainnya";
      } catch (e) {
        return "Lainnya";
      }
    }
    return "Lainnya";
  });

  const categoriesList = ["Semua", ...Array.from(new Set(itemCategories))];

  const filteredData = activeCategory === "Semua"
    ? activeItems
    : activeItems.filter((item, idx) => itemCategories[idx] === activeCategory);

  return (
    <section id="galeri" className="w-full py-24 bg-background relative">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            {displayTitle}
          </h2>
          <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-lg">
            {displaySubtitle}
          </p>
        </div>

        {/* Categories Tabs Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`font-plus-jakarta px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeCategory === cat
                  ? "bg-brand-emerald-600 text-white shadow-md shadow-brand-emerald-500/15"
                  : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-850"
              }`}
              aria-label={`Saring galeri dengan kategori ${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Pinterest Style Masonry Grid (columns-1 to columns-3) */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
          <AnimatePresence mode="popLayout">
            {filteredData.map((item, idx) => {
              const actImageUrl = item.image && typeof item.image === "object" ? item.image.url : (item.image_url || (item as any).image as string);
              const catName = itemCategories[activeItems.indexOf(item)] || "Umum";

              // Skip items that don't have an image URL from CMS
              if (!actImageUrl) return null;

              return (
                <motion.div
                  layout
                  key={actImageUrl || idx}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="break-inside-avoid relative rounded-[20px] overflow-hidden border border-zinc-200/50 dark:border-zinc-800/60 shadow-sm group cursor-pointer mb-6"
                >
                  {/* Height variations for masonry visual prominence */}
                  <div className={`relative w-full overflow-hidden ${
                    idx % 3 === 0 ? "aspect-square" : idx % 3 === 1 ? "aspect-4/5" : "aspect-3/2"
                  }`}>
                    <Image
                      src={actImageUrl}
                      alt={item.title || "Galeri Foto"}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-103"
                    />
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-emerald-950/70 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6" />
                    
                    <div className="absolute bottom-0 left-0 right-0 p-6 z-10 text-white translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="font-plus-jakarta text-[10px] font-bold tracking-wider uppercase bg-brand-lime-500 text-white px-2.5 py-1 rounded-full">
                        {catName}
                      </span>
                      <h4 className="font-fredoka text-lg font-bold mt-2 drop-shadow-sm leading-tight">
                        {item.title}
                      </h4>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}

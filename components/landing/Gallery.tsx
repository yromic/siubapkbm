"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface GalleryItem {
  image: string;
  title: string;
  category: string;
}

const galleryData: GalleryItem[] = [
  {
    image: "/images/gallery/gallery (1).webp",
    title: "Halaqoh Al-Qur'an Pagi di Gazebo Sekolah",
    category: "Keagamaan"
  },
  {
    image: "/images/gallery/gallery (2).webp",
    title: "Kegiatan PJOK Kebugaran Motorik Kasar",
    category: "Olahraga"
  },
  {
    image: "/images/gallery/gallery (3).webp",
    title: "Pendampingan Bermain di Klinik Trisula",
    category: "Akademis"
  },
  {
    image: "/images/gallery/gallery (4).webp",
    title: "Eksplorasi Karya Kriya 2D Halal di Hari Jumat",
    category: "Eksplorasi"
  },
  {
    image: "/images/gallery/gallery (5).webp",
    title: "Logika Terapan Melalui Koding Dasar",
    category: "Eksplorasi"
  },
  {
    image: "/images/gallery/gallery (6).webp",
    title: "Pembelajaran Literasi Menggunakan Media Konkret",
    category: "Akademis"
  },
  {
    image: "/images/gallery/gallery (7).webp",
    title: "Diskusi Kelompok Sosiosentris (Jean Piaget)",
    category: "Akademis"
  },
  {
    image: "/images/gallery/gallery (8).webp",
    title: "Aksi Nyata Berkhidmat Tolong Menolong Sesama",
    category: "Sosial"
  }
];

const categories = ["Semua", "Akademis", "Keagamaan", "Olahraga", "Eksplorasi", "Sosial"];

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState("Semua");

  const filteredData = activeCategory === "Semua"
    ? galleryData
    : galleryData.filter(item => item.category === activeCategory);

  return (
    <section id="galeri" className="w-full py-24 bg-background relative">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            Galeri Kegiatan Sekolah
          </h2>
          <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-lg">
            Dokumentasi keceriaan dan eksplorasi belajar aktif di dalam dan di luar lingkungan sekolah SIUBA.
          </p>
        </div>

        {/* Categories Tabs Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
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
            {filteredData.map((item, idx) => (
              <motion.div
                layout
                key={item.image}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="break-inside-avoid relative rounded-[20px] overflow-hidden border border-zinc-200/50 dark:border-zinc-800/60 shadow-sm group cursor-pointer mb-6"
              >
                {/* Dummy height variations to make masonry layout visually prominent */}
                <div className={`relative w-full overflow-hidden ${
                  idx % 3 === 0 ? "aspect-square" : idx % 3 === 1 ? "aspect-4/5" : "aspect-3/2"
                }`}>
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-103"
                  />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-emerald-950/70 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6" />
                  
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-10 text-white translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <span className="font-plus-jakarta text-[10px] font-bold tracking-wider uppercase bg-brand-lime-500 text-white px-2.5 py-1 rounded-full">
                      {item.category}
                    </span>
                    <h4 className="font-fredoka text-lg font-bold mt-2 drop-shadow-sm leading-tight">
                      {item.title}
                    </h4>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div>
    </section>
  );
}

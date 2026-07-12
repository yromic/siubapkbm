"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

const activities = [
  {
    image: "/images/activities/activity-1.webp",
    title: "07.00 - 09.00: Prime Time Halaqoh Quran",
    desc: "Memulai hari dengan pikiran segar bersama Al-Qur'an. Siswa dikelompokkan secara silang berdasarkan tingkat kemampuan riil membaca mereka (TaRL), bukan usia. Menghindari tekanan mental dan rasa minder pada anak.",
    category: "Pagi Hari"
  },
  {
    image: "/images/activities/activity-2.webp",
    title: "09.00 - Siang: Blok Akademik & Diniyyah Esensial",
    desc: "KBM dinamis yang berfokus penuh pada literasi pemahaman kritis dan matematika dasar dengan alat peraga nyata, meminimalkan ceramah satu arah. Menjauhkan anak dari rumus hafalan abstrak yang memusingkan.",
    category: "Siang Hari"
  },
  {
    image: "/images/activities/activity-3.webp",
    title: "Jumat Eksplorasi: Project & Life Skills Day",
    desc: "Bebas dari materi teori. Satu hari penuh didedikasikan untuk penciptaan seni kriya 2D halal, koding dasar, dan keterampilan hidup (life skills) agar anak aktif berkarya langsung dengan tangannya.",
    category: "Hari Jumat"
  }
];

export default function SchoolLife() {
  return (
    <section id="keseharian" className="w-full py-24 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <span className="font-plus-jakarta text-xs md:text-sm font-bold text-brand-emerald-600 uppercase tracking-widest bg-brand-emerald-50 dark:bg-brand-emerald-950/30 px-3 py-1.5 rounded-full inline-block">
            Alur Aktivitas
          </span>
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            Satu Hari di SIUBA
          </h2>
          <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-lg">
            Bagaimana ananda tumbuh ceria dan tangguh setiap hari melalui pembagian energi fokus kognitif yang optimal.
          </p>
        </div>

        {/* Storytelling Zig-Zag */}
        <div className="space-y-24">
          {activities.map((act, index) => {
            const isEven = index % 2 === 0;
            return (
              <div
                key={act.title}
                className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
              >
                {/* Image (re-ordered on desktop for zig-zag) */}
                <motion.div
                  initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7 }}
                  className={`lg:col-span-6 relative aspect-video sm:aspect-4/3 rounded-[24px] overflow-hidden border border-zinc-200/50 shadow-md ${isEven ? "lg:order-1" : "lg:order-2"
                    }`}
                >
                  <Image
                    src={act.image}
                    alt={act.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 hover:scale-102"
                  />
                  {/* Subtle category badge overlay */}
                  <span className="absolute top-4 left-4 bg-brand-emerald-600/90 backdrop-blur-md text-white font-plus-jakarta text-xs font-bold px-3.5 py-1.5 rounded-full z-10 shadow-sm border border-brand-emerald-500/30">
                    {act.category}
                  </span>
                </motion.div>

                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, x: isEven ? 50 : -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.7 }}
                  className={`lg:col-span-6 space-y-6 ${isEven ? "lg:order-2" : "lg:order-1"
                    }`}
                >
                  <h3 className="font-fredoka text-2xl md:text-3xl font-bold text-zinc-800 dark:text-zinc-200 leading-tight">
                    {act.title}
                  </h3>
                  <p className="font-plus-jakarta text-zinc-650 dark:text-zinc-400 text-base md:text-lg leading-relaxed">
                    {act.desc}
                  </p>
                </motion.div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

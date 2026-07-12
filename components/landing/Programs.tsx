"use client";

import React from "react";
import { motion } from "framer-motion";
import { BookOpen, Calculator, Bookmark } from "lucide-react";

const programs = [
  {
    title: "Literasi Pemahaman Kritis",
    desc: "Bukan sekadar mengeja, melainkan melatih kemampuan mencerna teks instruksi pendek/panjang, memahami makna bacaan, dan bernalar kritis untuk memecahkan masalah.",
    icon: BookOpen,
    badge: "Esensial",
    color: "from-brand-emerald-500 to-emerald-600",
    shadow: "shadow-brand-emerald-500/10"
  },
  {
    title: "Logika Hitung Fungsional",
    desc: "Menjauhkan anak dari rumus hafalan abstrak yang memusingkan. Fokus pada pemahaman logika hitung dasar yang aplikatif dalam kehidupan sehari-hari.",
    icon: Calculator,
    badge: "Fungsional",
    color: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/10"
  },
  {
    title: "Ilmu Diniyyah Dasar & Adab",
    desc: "Membina aqidah tauhid yang lurus berlandaskan sunnah, menuntaskan praktik ibadah fardhu 'ain (wudhu & shalat), serta membiasakan adab kesantunan harian.",
    icon: Bookmark,
    badge: "Karakter",
    color: "from-blue-500 to-cyan-600",
    shadow: "shadow-blue-500/10"
  }
];

export default function Programs() {
  return (
    <section id="program" className="w-full py-24 bg-background relative">
      {/* Decorative top curve */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none rotate-180">
        <svg className="w-full fill-white dark:fill-zinc-950" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,32L80,37.3C160,43,320,53,480,53.3C640,53,800,43,960,37.3C1120,32,1280,32,1360,32L1440,32L1440,80L1360,80C1280,80,1120,80,960,80C800,80,640,80,480,80C320,80,160,80,80,80L0,80Z" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-20">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <span className="font-plus-jakarta text-xs md:text-sm font-bold text-brand-emerald-600 uppercase tracking-widest bg-brand-emerald-50 dark:bg-brand-emerald-950/30 px-3 py-1.5 rounded-full inline-block">
            Kurikulum Esensial
          </span>
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            Trisula Kompetensi
          </h2>
          <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-lg">
            Kami memusatkan fokus kognitif siswa untuk menuntaskan tiga fondasi utama guna menghindari beban belajar berlebih (<strong>cognitive overload</strong>).
          </p>
        </div>

        {/* Grid Cards (3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {programs.map((prog, idx) => {
            const Icon = prog.icon;
            return (
              <motion.div
                key={prog.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-55px" }}
                transition={{ duration: 0.6, delay: idx * 0.05 }}
                className="group relative flex flex-col justify-between p-8 rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm transition-all hover:shadow-lg overflow-hidden"
              >
                {/* Decorative background shape */}
                <div className="absolute -top-12 -right-12 w-28 h-28 bg-gradient-to-br opacity-5 group-hover:opacity-10 transition-opacity rounded-full blur-xl" />

                <div className="space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${prog.color} text-white shadow-md ${prog.shadow}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-plus-jakarta text-xs font-bold px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-350 uppercase tracking-wider">
                      {prog.badge}
                    </span>
                  </div>

                  <h3 className="font-fredoka text-xl font-bold text-zinc-800 dark:text-zinc-250 group-hover:text-brand-emerald-600 transition-colors">
                    {prog.title}
                  </h3>

                  <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-sm leading-relaxed">
                    {prog.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

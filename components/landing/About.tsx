"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, Star } from "lucide-react";

export default function About() {
  return (
    <section id="tentang" className="w-full py-24 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* Large Image Left */}
          <div className="lg:col-span-6 relative">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative rounded-[24px] overflow-hidden border border-zinc-200/50 shadow-lg aspect-4/3 lg:aspect-square"
            >
              <Image
                src="/images/activities/activity-1.webp"
                alt="Tentang Sekolah Islam Ustman bin Affan"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 hover:scale-102"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-emerald-900/40 via-transparent to-transparent pointer-events-none" />
            </motion.div>

            {/* Small Organic Floating Badge */}
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
                  <h4 className="font-fredoka font-bold text-lg leading-none">Terakreditasi A</h4>
                  <p className="font-plus-jakarta text-xs text-white/90 mt-1">Sekolah Unggulan & Inovatif</p>
                </div>
              </div>
            </motion.div>
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
                Kredibilitas Resmi
              </span>
              <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150 leading-tight">
                Kualitas Alternatif yang Sah dan Diakui Negara
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="font-plus-jakarta text-zinc-600 dark:text-zinc-400 space-y-4 text-base md:text-lg leading-relaxed"
            >
              <p>
                Diselenggarakan sebagai program Pendidikan Kesetaraan Paket A (setaraf SD) resmi di bawah PKBM Baitusyukur Learning Center, SIUBA mendobrak stigma pendidikan kesetaraan di masyarakat.
              </p>
              <p>
                Kami memosisikan sekolah bukan sebagai pelarian administratif bagi anak bermasalah, melainkan sebagai mitra pengasuhan utama (<strong>Madrasatul Ula</strong>) pilihan pertama bagi keluarga modern untuk mendidik generasi bertaqwa yang beradab dan berakal kuat.
              </p>
            </motion.div>

            {/* Quick stats checklist / Trust Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="space-y-6 pt-4 border-t border-zinc-100 dark:border-zinc-800"
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl font-bold text-brand-emerald-600 font-fredoka min-w-16">
                  A
                </div>
                <div>
                  <h4 className="font-fredoka text-base font-bold text-zinc-800 dark:text-zinc-200">Terakreditasi A</h4>
                  <p className="font-plus-jakarta text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Peringkat unggul standar kelulusan nasional.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="text-2xl font-bold text-brand-emerald-600 font-fredoka min-w-16">
                  1 : 12
                </div>
                <div>
                  <h4 className="font-fredoka text-base font-bold text-zinc-800 dark:text-zinc-200">Rasio Tutor & Murid</h4>
                  <p className="font-plus-jakarta text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Perhatian dan pendampingan individual yang maksimal.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="text-2xl font-bold text-brand-emerald-600 font-fredoka min-w-16">
                  100%
                </div>
                <div>
                  <h4 className="font-fredoka text-base font-bold text-zinc-800 dark:text-zinc-200">Resmi & Sah</h4>
                  <p className="font-plus-jakarta text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Ijazah resmi diakui penuh untuk melanjutkan ke jenjang SMP/Mts.</p>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}

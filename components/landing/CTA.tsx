"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquareCode } from "lucide-react";

export default function CTA() {
  return (
    <section className="w-full py-20 bg-white dark:bg-zinc-950 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Banner container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-[32px] bg-gradient-to-tr from-brand-emerald-700 via-brand-emerald-600 to-brand-lime-600 p-8 md:p-16 text-white text-center overflow-hidden shadow-xl"
        >
          {/* Decorative geometric background elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-12 translate-x-12 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-lime-500/10 rounded-full blur-3xl translate-y-12 -translate-x-12 pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 max-w-3xl mx-auto space-y-8">
            <h2 className="font-fredoka text-3xl md:text-5xl lg:text-6xl font-bold leading-tight drop-shadow-sm">
              Mari Bermitra Menjaga Fitrah Tumbuh Kembang Ananda
            </h2>
            <p className="font-plus-jakarta text-zinc-100 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              Pendidikan adalah perjalanan jangka panjang. Mari jadwalkan sesi konsultasi santai dengan tim pendidik kami untuk memahami bagaimana SIUBA mendukung masa keemasan putra-putri Ayah Bunda.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="https://wa.me/6289655496283"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Jadwalkan konsultasi via WhatsApp"
                className="font-plus-jakarta flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white hover:bg-zinc-50 active:bg-zinc-100 text-brand-emerald-700 font-bold text-base shadow-lg transition-all transform hover:-translate-y-0.5 w-full sm:w-auto cursor-pointer"
              >
                Jadwalkan Konsultasi WhatsApp
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="#kontak"
                aria-label="Daftar PPDB Online"
                className="font-plus-jakarta flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-brand-emerald-500 hover:bg-brand-emerald-600 active:bg-brand-emerald-700 text-white font-bold text-base border border-brand-emerald-400/50 shadow-md transition-all transform hover:-translate-y-0.5 w-full sm:w-auto cursor-pointer"
              >
                Daftar PPDB Online
              </Link>
            </div>
          </div>

        </motion.div>

      </div>
    </section>
  );
}

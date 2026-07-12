"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";

export default function Principal() {
  // Set to true in the future to show the principal's photo and name
  const showPrincipalIdentity = false;

  return (
    <section className="w-full py-24 bg-background relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className={showPrincipalIdentity ? "grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center" : "max-w-3xl mx-auto"}>

          {/* Photo Left */}
          {showPrincipalIdentity && (
            <div className="lg:col-span-5 relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="relative aspect-3/4 rounded-[28px] overflow-hidden border-4 border-white shadow-xl max-w-sm mx-auto"
              >
                <Image
                  src="/images/principal/principal.jpg"
                  alt="Kepala Sekolah SIUBA"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
                {/* Overlay styling for elegant depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </motion.div>
            </div>
          )}

          {/* Greeting Right */}
          <div className={showPrincipalIdentity ? "lg:col-span-7 space-y-6 relative" : "space-y-6 relative text-left"}>
            {/* Absolute quote icon behind text */}
            <div className="absolute -top-10 -left-6 text-brand-emerald-500/10 pointer-events-none">
              <Quote className="w-20 h-20 stroke-[3]" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-2 relative z-10"
            >
              <span className="font-plus-jakarta text-xs md:text-sm font-bold text-brand-emerald-600 uppercase tracking-widest bg-brand-emerald-100/50 px-3 py-1.5 rounded-full inline-block">
                Sambutan Hangat
              </span>
              <h2 className="font-fredoka text-3xl md:text-4xl font-bold text-zinc-850 dark:text-zinc-150">
                Mempersiapkan Generasi Rabbani yang Cerdas & Santun
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-plus-jakarta text-zinc-655 dark:text-zinc-400 space-y-4 text-base md:text-lg leading-relaxed relative z-10"
            >
              <p>
                Assalamualaikum Warahmatullahi Wabarakatuh,
              </p>
              <p>
                Selamat datang di SIUBA. Kehormatan bagi kami bermitra dengan Bapak/Ibu sekalian dalam wadah pendidikan alternatif yang mengutamakan adab di atas ilmu, perlindungan kesehatan batin anak, serta penumbuhan fitrah unik anak secara alami.
              </p>
              <p>
                Melalui sinergi <strong>Madrasatul Ula</strong>, kami memastikan anak dididik dalam lingkungan yang aman secara psikologis (<strong>psychological safety</strong>), bebas dari perundungan, dan bebas dari tekanan akademik yang tidak wajar. Kami optimis melahirkan anak didik yang berkarakter UTSMAN.
              </p>
              <p>
                Terima kasih atas amanah dan kepercayaan Ayah Bunda. Mari bersama bersinergi menumbuhkan generasi bertaqwa pembangun umat.
              </p>
            </motion.div>

            {showPrincipalIdentity && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="pt-4"
              >
                <h4 className="font-fredoka text-xl font-bold text-zinc-800 dark:text-zinc-200">
                  Nurhadi Mursidin Putra, S.Pd.
                </h4>
                <span className="font-plus-jakarta text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1 block">
                  Kepala Sekolah SIUBA - PKBM BLC
                </span>
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

interface Testimonial {
  image: string;
  name: string;
  role: string;
  text: string;
}

const testimonials: Testimonial[] = [
  {
    image: "/images/testimonials/parent-1.jpg",
    name: "Ummu Abdillah",
    role: "Wali Murid Kelas 2",
    text: "Masya Allah, perubahan adab harian anak saya sejak menerapkan Budaya SAHABAT sangat nyata di rumah. Hubungan kami dan tutor terjalin erat sebagai mitra pengasuhan (Madrasatul Ula)."
  },
  {
    image: "/images/testimonials/parent-2.jpg",
    name: "Abu Salman",
    role: "Wali Murid Kelas 4",
    text: "Dengan Klinik Trisula, anak saya mendapatkan pendampingan belajar yang menyenangkan tanpa rasa minder. Sekarang ia tumbuh mandiri dalam ibadah wajib dan merapikan barangnya sendiri."
  },
  {
    image: "/images/testimonials/parent-3.jpg",
    name: "Bunda Rania",
    role: "Wali Murid Kelas 5",
    text: "Sangat tenang menyekolahkan anak di SIUBA karena lingkungannya bebas tekanan akademis. Anak saya tumbuh ceria, beradab santun, dan sangat menyukai buku bacaan tanpa perlu dipaksa."
  }
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  const prev = () => {
    setCurrent((prevVal) => (prevVal === 0 ? testimonials.length - 1 : prevVal - 1));
  };

  const next = () => {
    setCurrent((prevVal) => (prevVal === testimonials.length - 1 ? 0 : prevVal + 1));
  };

  return (
    <section className="w-full py-24 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="font-plus-jakarta text-xs md:text-sm font-bold text-brand-emerald-600 uppercase tracking-widest bg-brand-emerald-50 dark:bg-brand-emerald-950/30 px-3 py-1.5 rounded-full inline-block">
            Testimoni Orang Tua
          </span>
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            Apa Kata Mereka?
          </h2>
        </div>

        {/* Carousel Area */}
        <div className="relative p-8 md:p-12 rounded-[32px] bg-surface-1 border border-zinc-200/50 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row gap-8 items-center">
          
          {/* Quote Icon Overlay */}
          <div className="absolute top-6 right-8 text-brand-emerald-500/10 pointer-events-none">
            <Quote className="w-24 h-24 stroke-[4]" />
          </div>

          {/* Parent Image */}
          <div className="w-28 h-28 md:w-36 md:h-36 relative rounded-full overflow-hidden border-4 border-white shadow-md flex-shrink-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <Image
                  src={testimonials[current].image}
                  alt={testimonials[current].name}
                  fill
                  sizes="144px"
                  className="object-cover"
                />
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
                  &ldquo;{testimonials[current].text}&rdquo;
                </p>
                <div>
                  <h4 className="font-fredoka text-xl font-bold text-zinc-800 dark:text-zinc-200">
                    {testimonials[current].name}
                  </h4>
                  <span className="font-plus-jakarta text-xs font-bold text-brand-emerald-600 uppercase tracking-wider">
                    {testimonials[current].role}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation Controls */}
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
          </div>

        </div>

      </div>
    </section>
  );
}

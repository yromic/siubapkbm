"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "Apakah ijazah Paket A SIUBA setara dengan SD konvensional?",
    answer: "Ya, ijazah Pendidikan Kesetaraan Paket A yang diselenggarakan resmi oleh PKBM Baitusyukur Learning Center diakui penuh oleh negara (Kemendikbudristek) dan memiliki hak hukum yang sama untuk digunakan mendaftar ke SMP Negeri maupun Swasta unggulan tanpa ada hambatan administratif."
  },
  {
    question: "Bagaimana kurikulum SIUBA diselenggarakan?",
    answer: "Kami mengadopsi filosofi Esensialisme Transformatif, memangkas keluasan materi teoretis dan memusatkan energi kognitif siswa pada Trisula Kompetensi (Literasi Membaca Pemahaman, Numerasi Logika Hitung Dasar, dan Ilmu Diniyyah Dasar berlandaskan sunnah)."
  },
  {
    question: "Bagaimana sekolah mendisiplinkan anak jika terjadi pelanggaran adab?",
    answer: "Kami menolak hukuman yang bersifat menekan (punitive) baik fisik maupun verbal. Kedisiplinan ditegakkan melalui sistem Konsekuensi Logis dan Restitusi (pembinaan batin untuk tobat/istighfar dan tanggung jawab memperbaiki kesalahan secara aktif)."
  },
  {
    question: "Apa itu Klinik Trisula dan siapa saja yang memasukinya?",
    answer: "Klinik Trisula adalah program jaring pengaman akademis interaktif pasca-KBM. Siswa yang teridentifikasi butuh dukungan tambahan dalam literasi atau numerasi dibersamai menggunakan alat peraga bermain yang menyenangkan agar tidak merasa minder atau tertinggal."
  },
  {
    question: "Bagaimana rasio guru dan murid serta kenyamanan belajar?",
    answer: "Rasio tutor dan siswa dirancang ideal (1:12) untuk menjamin perhatian personal yang maksimal. Kelas difungsikan sebagai laboratorium sosial modern-minimalis yang aman secara psikologis (psychological safety) dan bebas perundungan."
  }
];

function AccordionItem({ question, answer, isOpen, onToggle }: FAQItem & { isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-zinc-200/60 dark:border-zinc-800/80 rounded-[20px] bg-white dark:bg-zinc-900 shadow-sm overflow-hidden transition-all duration-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 text-left focus:outline-none cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="font-fredoka text-lg font-bold text-zinc-800 dark:text-zinc-200 pr-4">
          {question}
        </span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          isOpen ? "bg-brand-emerald-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-650"
        }`}>
          {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="px-6 pb-6 pt-0 font-plus-jakarta text-zinc-600 dark:text-zinc-400 text-sm md:text-base leading-relaxed border-t border-zinc-50 dark:border-zinc-800/40">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="w-full py-24 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="max-w-4xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-emerald-50 dark:bg-brand-emerald-950/30 text-brand-emerald-600 mx-auto">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            Tanya Jawab (FAQ)
          </h2>
          <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-lg">
            Temukan jawaban cepat atas pertanyaan-pertanyaan yang sering ditanyakan orang tua calon siswa.
          </p>
        </div>

        {/* List of Accordions */}
        <div className="space-y-4">
          {faqData.map((item, idx) => (
            <AccordionItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === idx}
              onToggle={() => handleToggle(idx)}
            />
          ))}
        </div>

      </div>
    </section>
  );
}

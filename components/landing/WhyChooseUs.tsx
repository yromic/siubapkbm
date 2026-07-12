"use client";

import React from "react";
import { motion } from "framer-motion";
import { BookOpen, Activity, Heart, Shield, HelpCircle } from "lucide-react";

export default function WhyChooseUs() {
  return (
    <section id="pendekatan" className="w-full py-24 bg-background relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="font-plus-jakarta text-xs md:text-sm font-bold text-brand-emerald-600 uppercase tracking-widest bg-brand-emerald-50 dark:bg-brand-emerald-950/30 px-3 py-1.5 rounded-full inline-block">
            Diferensiasi Kami
          </span>
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            Pendekatan Belajar Terpadu
          </h2>
          <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-lg">
            Kami menerapkan metode mutakhir yang berfokus pada fitrah alami anak untuk memastikan tumbuhnya adab, kemandirian, dan kecintaan pada ilmu.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Card 1: Halaqoh Qur'an TaRL (Width 2/3 - col-span-2) */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-2 p-8 rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
          >
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-brand-emerald-950/30 text-brand-emerald-700">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="font-fredoka text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                  Halaqoh Qur'an TaRL (Teaching at the Right Level)
                </h3>
                <span className="font-plus-jakarta text-xs font-bold text-brand-emerald-600 uppercase tracking-wider block">
                  Metode Silang Lintas Kelas
                </span>
              </div>
              <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-base leading-relaxed">
                Kami melebur batas kelas konvensional dalam belajar Al-Qur'an. Siswa dikelompokkan secara silang berdasarkan tingkat kemampuan riil membaca mereka (TaRL), bukan usia. Pendekatan ini menumbuhkan rasa percaya diri dan menghindari tekanan mental atau minder pada anak.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Klinik Trisula (Width 1/3) */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="p-8 rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-950/30 text-red-650">
                <HelpCircle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="font-fredoka text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                  Klinik Trisula
                </h3>
                <span className="font-plus-jakarta text-xs font-bold text-red-600 uppercase tracking-wider block">
                  No Child Left Behind
                </span>
              </div>
              <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-sm leading-relaxed">
                Jaring pengaman khusus bagi siswa yang mengalami kesulitan literasi dan numerasi dasar. Melalui pendampingan interaktif pasca-KBM dengan metode alat peraga dan bermain, kami menjamin tidak ada siswa yang tertinggal.
              </p>
            </div>
          </motion.div>

          {/* Card 3: Gaya Belajar VAK (Width 1/3) */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="p-8 rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/30 text-brand-amber-600">
                <Activity className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="font-fredoka text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                  Gaya Belajar VAK
                </h3>
                <span className="font-plus-jakarta text-xs font-bold text-brand-amber-600 uppercase tracking-wider block">
                  Akomodasi Pilihan (Choice Board)
                </span>
              </div>
              <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-sm leading-relaxed">
                Kami menyadari bakat anak bervariasi. Melalui menu pilihan tugas (<strong>Choice Board</strong>), anak-anak difasilitasi belajar sesuai gaya belajar Visual, Auditori, dan Kinestetik untuk menghasilkan karya terbaiknya.
              </p>
            </div>
          </motion.div>

          {/* Card 4: Konsekuensi Logis & Restitusi (Width 1/3) */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-8 rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-950/30 text-blue-600">
                <Shield className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="font-fredoka text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                  Konsekuensi Logis
                </h3>
                <span className="font-plus-jakarta text-xs font-bold text-blue-600 uppercase tracking-wider block">
                  Disiplin Positif & Restitusi
                </span>
              </div>
              <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-sm leading-relaxed">
                Menolak hukuman fisik maupun verbal yang kaku. Kedisiplinan ditegakkan melalui Konsekuensi Logis dan Restitusi (perbaikan kesalahan secara mandiri), mengedukasi adab secara tulus dan damai.
              </p>
            </div>
          </motion.div>

          {/* Card 5: Kemitraan Madrasatul Ula (Width 1/3) */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="p-8 rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-purple-50 dark:bg-purple-950/30 text-purple-650">
                <Heart className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="font-fredoka text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                  Madrasatul Ula
                </h3>
                <span className="font-plus-jakarta text-xs font-bold text-purple-600 uppercase tracking-wider block">
                  Sinergi Rumah-Sekolah
                </span>
              </div>
              <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-sm leading-relaxed">
                Kami memosisikan Ayah Bunda sebagai pendidik pertama yang utama. Melalui keselarasan adab harian dan pembatasan gawai di rumah, visi tumbuh kembang anak dicapai secara nyata dan terukur.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

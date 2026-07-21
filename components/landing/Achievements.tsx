"use client";

import React from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";

const defaultAchievements = [
  {
    title: "U - Unggul",
    subtitle: "Daya Saing & Resiliensi",
    description: "Mempunyai ketahanan mental (resiliensi) kognitif untuk gigih mencoba dan tidak mudah menyerah saat menghadapi kesulitan belajar (Fathonah & Istiqamah).",
    icon: "Zap"
  },
  {
    title: "T - Terampil",
    subtitle: "Kreativitas & Kecakapan Hidup",
    description: "Cakap menggerakkan kemampuan motorik dan nalar untuk menghasilkan karya kriya visual 2D orisinal maupun proyek fungsional harian yang halal.",
    icon: "Award"
  },
  {
    title: "S - Santun",
    subtitle: "Adab Islami & Empati",
    description: "Menampilkan stabilitas emosi, kelembutan tutur kata, dan perilaku hormat kepada tutor maupun sesama rekan (Budaya Harian SAHABAT).",
    icon: "Heart"
  },
  {
    title: "M - Mandiri",
    subtitle: "Regulasi Diri & Ibadah Tuntas",
    description: "Tuntas dalam kemandirian personal dasar: terbiasa merapikan barang pribadi, menjaga kebersihan diri, serta inisiatif shalat tanpa paksaan.",
    icon: "User"
  },
  {
    title: "A - Akrab dengan Ilmu",
    subtitle: "Cinta Literasi & Qurani",
    description: "Tumbuhnya motivasi belajar intrinsik. Anak memandang buku dan Al-Qur'an sebagai ruang petualangan eksplorasi yang asyik dan menyenangkan.",
    icon: "BookOpen"
  },
  {
    title: "N - Nyata Berkhidmat",
    subtitle: "Altruisme & Kepedulian Sosial",
    description: "Memiliki kepekaan sosial tinggi, gemar menolong sesama teman di sekolah, serta siap berkontribusi nyata bagi kenyamanan ekosistemnya.",
    icon: "HeartHandshake"
  }
];

interface AchievementsProps {
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  items?: Array<{
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    icon?: string | null;
    custom_fields?: any;
  }>;
}

const getAchievementStyles = (index: number) => {
  const styles = [
    {
      iconColor: "text-amber-500",
      bgGradient: "from-amber-500/10 to-amber-500/0",
      borderColor: "border-amber-200/50 dark:border-amber-800/30"
    },
    {
      iconColor: "text-brand-lime-500",
      bgGradient: "from-brand-lime-500/10 to-brand-lime-500/0",
      borderColor: "border-brand-lime-200/50 dark:border-brand-lime-800/30"
    },
    {
      iconColor: "text-red-500",
      bgGradient: "from-red-500/10 to-red-500/0",
      borderColor: "border-red-200/50 dark:border-red-800/30"
    },
    {
      iconColor: "text-blue-500",
      bgGradient: "from-blue-500/10 to-blue-500/0",
      borderColor: "border-blue-200/50 dark:border-blue-800/30"
    },
    {
      iconColor: "text-brand-emerald-500",
      bgGradient: "from-brand-emerald-500/10 to-brand-emerald-500/0",
      borderColor: "border-brand-emerald-200/50 dark:border-brand-emerald-800/30"
    },
    {
      iconColor: "text-purple-500",
      bgGradient: "from-purple-500/10 to-purple-500/0",
      borderColor: "border-purple-200/50 dark:border-purple-800/30"
    }
  ];
  return styles[index % styles.length];
};

export default function Achievements({ title, subtitle, badge, items }: AchievementsProps) {
  const displayBadge = badge || "Target Output Siswa";
  const displayTitle = title || "Profil Lulusan UTSMAN";
  const displaySubtitle = subtitle || "Rangkaian karakter batin (Karakter FITRAH) dan pembiasaan fisik (Budaya SAHABAT) yang kami persiapkan melekat erat pada sanubari anak setelah lulus.";

  const activeItems = items && items.length > 0 ? items : defaultAchievements;

  return (
    <section id="prestasi" className="w-full py-24 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <span className="font-plus-jakarta text-xs md:text-sm font-bold text-brand-emerald-600 uppercase tracking-widest bg-brand-emerald-50 dark:bg-brand-emerald-950/30 px-3 py-1.5 rounded-full inline-block">
            {displayBadge}
          </span>
          <h2 className="font-fredoka text-3xl md:text-5xl font-bold text-zinc-850 dark:text-zinc-150">
            {displayTitle}
          </h2>
          <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-lg">
            {displaySubtitle}
          </p>
        </div>

        {/* Grid Card Layout (3 columns on desktop, 1 on mobile/tablet) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {activeItems.map((item, idx) => {
            const Icon = (item.icon && (LucideIcons as any)[item.icon]) || LucideIcons.Award;
            const style = getAchievementStyles(idx);

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: idx * 0.05 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`relative p-8 rounded-[24px] bg-gradient-to-b ${style.bgGradient} bg-white dark:bg-zinc-900 border ${style.borderColor} shadow-sm flex flex-col justify-between transition-shadow hover:shadow-md overflow-hidden`}
              >
                {/* Card Content */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-white dark:bg-zinc-850 shadow-sm border border-zinc-100 dark:border-zinc-800 ${style.iconColor}`}>
                      <Icon className="w-8 h-8" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-fredoka text-xl font-bold text-zinc-800 dark:text-zinc-200 leading-tight">
                      {item.title}
                    </h3>
                    {item.subtitle && (
                      <span className="font-plus-jakarta text-xs font-bold text-brand-emerald-600 block">
                        {item.subtitle}
                      </span>
                    )}
                  </div>

                  <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-sm leading-relaxed">
                    {item.description}
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

"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Users, UserCheck, GraduationCap, Trophy, ClipboardCheck } from "lucide-react";

interface StatItemProps {
  icon: React.ElementType;
  value: number;
  label: string;
  suffix?: string;
}

function Counter({ value, isCompleted }: { value: number; isCompleted: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isCompleted) return;

    let start = 0;
    const end = value;
    const duration = 2000; // 2 seconds
    const range = end - start;
    let current = start;
    const increment = end > 100 ? Math.ceil(end / 60) : 1;
    const stepTime = Math.abs(Math.floor(duration / (range / increment)));

    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, isCompleted]);

  return <span>{count}</span>;
}

function StatCard({ icon: Icon, value, label, suffix = "" }: StatItemProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div
      ref={ref}
      className="p-8 rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm flex flex-col items-center text-center space-y-4 hover:shadow-md transition-shadow"
    >
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-brand-emerald-50 dark:bg-brand-emerald-950/30 text-brand-emerald-600">
        <Icon className="w-7 h-7" />
      </div>
      <div className="font-fredoka text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-emerald-600 to-brand-lime-500 bg-clip-text text-transparent">
        <Counter value={value} isCompleted={isInView} />
        {suffix}
      </div>
      <span className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-sm font-semibold">
        {label}
      </span>
    </div>
  );
}

export default function Statistics() {
  return (
    <section className="w-full py-20 bg-background relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 md:gap-8">
          <StatCard icon={GraduationCap} value={35} label="Jumlah Guru & Staf" suffix="+" />
          <StatCard icon={Users} value={240} label="Jumlah Siswa" suffix="+" />
          <StatCard icon={ClipboardCheck} value={12} label="Program Unggulan" />
          <StatCard icon={UserCheck} value={18} label="Kegiatan Sekolah" />
          <StatCard icon={Trophy} value={45} label="Prestasi Juara" suffix="+" />
        </div>
      </div>
    </section>
  );
}

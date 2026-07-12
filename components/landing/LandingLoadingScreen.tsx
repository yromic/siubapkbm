"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Rocket,
  Star,
  GraduationCap,
  Pencil,
  Heart,
  Sparkles,
  Moon,
} from "lucide-react";

// ─── Brand palette untuk wave ───────────────────────────────────────────────
const WAVES = [
  {
    bg: "#10b981",        // brand-emerald-500
    text: "#ffffff",
    accent: "#ecfdf5",
  },
  {
    bg: "#fdfbf7",        // brand-cream
    text: "#047857",      // brand-emerald-700
    accent: "#10b981",
  },
  {
    bg: "#84cc16",        // brand-lime-500
    text: "#ffffff",
    accent: "#f7fee7",
  },
  {
    bg: "#f59e0b",        // brand-amber-500
    text: "#ffffff",
    accent: "#fffbeb",
  },
  {
    bg: "#059669",        // brand-emerald-600
    text: "#ffffff",
    accent: "#d1fae5",
  },
];

// ─── Arah sweep bergantian ───────────────────────────────────────────────────
type Direction = "right" | "bottom" | "left" | "top";
const DIRECTIONS: Direction[] = ["right", "bottom", "left", "top"];

function getClipVariants(direction: Direction) {
  const hidden: Record<Direction, string> = {
    right:  "inset(0 100% 0 0)",
    bottom: "inset(100% 0 0 0)",
    left:   "inset(0 0 0 100%)",
    top:    "inset(0 0 100% 0)",
  };
  return {
    hidden: { clipPath: hidden[direction] },
    visible: {
      clipPath: "inset(0 0% 0 0)",
      transition: { duration: 0.72, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] },
    },
  };
}

// ─── Fun messages + icon pairs ───────────────────────────────────────────────
const MESSAGES = [
  { text: "Bismillah, sedang menyiapkan sesuatu untukmu…",   Icon: Moon },
  { text: "Hampir siap! Lebih cepat dari PR Matematika",     Icon: Pencil },
  { text: "Menyiapkan ilmu yang bermanfaat buat hari ini…",  Icon: BookOpen },
  { text: "Bentar ya, gurunya lagi pemanasan dulu 😄",        Icon: GraduationCap },
  { text: "Mewarnai halaman… tapi versi digital!",           Icon: Sparkles },
  { text: "Jangan ke mana-mana, sebentar lagi terbang!",     Icon: Rocket },
  { text: "Nyiapin bintang terbaik buat kamu…",              Icon: Star },
  { text: "Loading dengan penuh cinta dari SIUBA ❤️",        Icon: Heart },
];

// ─── Floating particle positions ─────────────────────────────────────────────
const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  x: [15, 25, 40, 55, 70, 80, 60, 35][i],
  y: [20, 70, 15, 80, 25, 60, 85, 45][i],
  delay: i * 0.3,
  duration: 3 + (i % 3),
  size: [10, 14, 8, 12, 10, 14, 8, 10][i],
}));

export default function LandingLoadingScreen() {
  const [waveIndex, setWaveIndex]     = useState(0);
  const [msgIndex, setMsgIndex]       = useState(0);
  const [dirIndex, setDirIndex]       = useState(0);
  const [mounted, setMounted]         = useState(false);

  // mount flag — hindari SSR mismatch
  useEffect(() => { setMounted(true); }, []);

  // Rotasi warna + pesan + arah tiap 1.6 detik
  useEffect(() => {
    if (!mounted) return;
    const timer = setInterval(() => {
      setWaveIndex((prev) => (prev + 1) % WAVES.length);
      setMsgIndex((prev)  => (prev + 1) % MESSAGES.length);
      setDirIndex((prev)  => (prev + 1) % DIRECTIONS.length);
    }, 1600);
    return () => clearInterval(timer);
  }, [mounted]);

  const wave      = WAVES[waveIndex];
  const direction = DIRECTIONS[dirIndex];
  const { text: msg, Icon: MsgIcon } = MESSAGES[msgIndex];

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ backgroundColor: WAVES[(waveIndex - 1 + WAVES.length) % WAVES.length].bg }}
      role="status"
      aria-label="Memuat halaman SIUBA"
    >
      {/* ── Color wave layer ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={waveIndex}
          variants={getClipVariants(direction)}
          initial="hidden"
          animate="visible"
          className="absolute inset-0"
          style={{ backgroundColor: wave.bg }}
        />
      </AnimatePresence>

      {/* ── Floating particles ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full opacity-20"
            style={{
              left:   `${p.x}%`,
              top:    `${p.y}%`,
              width:  p.size,
              height: p.size,
              backgroundColor: wave.accent,
            }}
            animate={{
              y:       [0, -18, 0],
              opacity: [0.15, 0.35, 0.15],
              scale:   [1, 1.3, 1],
            }}
            transition={{
              duration: p.duration,
              delay:    p.delay,
              repeat:   Infinity,
              ease:     "easeInOut",
            }}
          />
        ))}
      </div>

      {/* ── Center content ── */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8 px-6">

        {/* Logo / Brand mark */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "backOut" }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl"
            style={{ backgroundColor: wave.bg === "#fdfbf7" ? wave.text : wave.bg }}
          >
            <img
              src="/favicon.ico"
              alt="Logo Sekolah"
              className="w-12 h-12 object-contain"
            />
          </motion.div>

          <motion.p
            style={{ color: wave.text }}
            className="font-fredoka text-2xl font-bold tracking-wide"
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            SIUBA
          </motion.p>
        </motion.div>

        {/* ── Rotating fun message ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={msgIndex}
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.92 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex flex-col items-center gap-3 text-center max-w-sm"
          >
            {/* Icon badge */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: wave.accent }}
            >
              <MsgIcon
                style={{ color: wave.bg === "#fdfbf7" ? wave.text : wave.bg }}
                strokeWidth={1.8}
                className="w-6 h-6"
              />
            </div>

            {/* Message text */}
            <p
              className="font-plus-jakarta text-base md:text-lg font-semibold leading-snug"
              style={{ color: wave.text }}
            >
              {msg}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* ── Dot progress indicator ── */}
        <div className="flex items-center gap-2 mt-2">
          {WAVES.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ backgroundColor: wave.text, height: 8 }}
              animate={{
                width:   i === waveIndex ? 24 : 8,
                opacity: i === waveIndex ? 1 : 0.3,
              }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          ))}
        </div>

      </div>
    </div>
  );
}

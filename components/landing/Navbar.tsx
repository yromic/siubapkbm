"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NavbarProps {
  menuItems?: Array<{ label: string; url: string }>;
  shortName?: string;
  logoUrl?: string | null;
}

export default function Navbar({ menuItems, shortName = "SIUBA", logoUrl }: NavbarProps) {
  // Navigation items exclusively from CMS database; empty array if not yet configured
  const navItems = menuItems ? menuItems.map(item => ({ label: item.label, href: item.url })) : [];
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-55 w-[92%] max-w-7xl transition-all duration-300 rounded-2xl ${
          isScrolled
            ? "bg-white/90 dark:bg-zinc-900/90 shadow-lg border border-zinc-200/50 dark:border-zinc-800/50 backdrop-blur-md py-3"
            : "bg-white/40 dark:bg-zinc-950/40 border border-white/20 dark:border-zinc-800/20 backdrop-blur-sm py-4"
        }`}
      >
        <div className="flex items-center justify-between px-6 md:px-8">
          {/* Logo */}
          <Link href="#beranda" className="flex items-center gap-2" aria-label="SIUBA Beranda">
            {logoUrl ? (
              <div className="relative h-10 w-28">
                <Image
                  src={logoUrl}
                  alt={shortName}
                  fill
                  sizes="112px"
                  priority
                  className="object-contain object-left"
                />
              </div>
            ) : (
              <span className="font-fredoka text-2xl font-bold bg-gradient-to-r from-brand-emerald-600 to-brand-lime-500 bg-clip-text text-transparent">
                {shortName}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="font-plus-jakarta text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-brand-emerald-600 dark:hover:text-brand-emerald-500 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* CTA Action */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              href="/parent/login"
              aria-label="Masuk Portal Orang Tua"
              className="font-plus-jakarta inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-emerald-600 hover:bg-brand-emerald-700 active:bg-brand-emerald-700 text-white font-bold text-sm shadow-md shadow-brand-emerald-500/10 transition-colors cursor-pointer"
            >
              Masuk SIUBA
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-zinc-700 dark:text-zinc-300 hover:text-brand-emerald-600 focus:outline-none"
            aria-label={isMobileMenuOpen ? "Tutup menu" : "Buka menu"}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-7xl bg-white/95 dark:bg-zinc-900/95 shadow-xl border border-zinc-200 dark:border-zinc-800 backdrop-blur-lg rounded-2xl p-6 lg:hidden flex flex-col gap-6"
          >
            <nav className="flex flex-col gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-plus-jakarta text-base font-bold text-zinc-850 dark:text-zinc-200 hover:text-brand-emerald-600 transition-colors py-2 border-b border-zinc-100 dark:border-zinc-800"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/parent/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-plus-jakarta w-full text-center py-3 rounded-xl bg-brand-emerald-600 hover:bg-brand-emerald-700 text-white font-bold text-sm shadow-md transition-colors"
            >
              Masuk SIUBA
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

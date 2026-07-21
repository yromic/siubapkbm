"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, HelpCircle } from "lucide-react";

interface FAQItem {
  title?: string | null;
  description?: string | null;
}

function AccordionItem({ title, description, isOpen, onToggle }: FAQItem & { isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-zinc-200/60 dark:border-zinc-800/80 rounded-[20px] bg-white dark:bg-zinc-900 shadow-sm overflow-hidden transition-all duration-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 text-left focus:outline-none cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="font-fredoka text-lg font-bold text-zinc-800 dark:text-zinc-200 pr-4">
          {title}
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
              {description}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FAQProps {
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  items?: FAQItem[];
}

export default function FAQ({ title, subtitle, badge, items }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // All display values from CMS props only
  const displayBadge = badge || "";
  const displayTitle = title || "";
  const displaySubtitle = subtitle || "";

  // FAQ items exclusively from CMS; empty = section renders header only (no crash)
  const activeItems = items && items.length > 0 ? items : [];

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
            {displayTitle}
          </h2>
          <p className="font-plus-jakarta text-zinc-550 dark:text-zinc-400 text-lg">
            {displaySubtitle}
          </p>
        </div>

        {/* List of Accordions */}
        <div className="space-y-4">
          {activeItems.map((item, idx) => (
            <AccordionItem
              key={idx}
              title={item.title}
              description={item.description}
              isOpen={openIndex === idx}
              onToggle={() => handleToggle(idx)}
            />
          ))}
        </div>

      </div>
    </section>
  );
}

"use client";

import React from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";



interface WhyChooseUsProps {
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

const getThemeClasses = (theme?: string) => {
  switch (theme) {
    case "red":
      return {
        bg: "bg-red-50 dark:bg-red-950/30",
        text: "text-red-650",
        badge: "text-red-600"
      };
    case "amber":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-brand-amber-600",
        badge: "text-brand-amber-600"
      };
    case "blue":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        text: "text-blue-600",
        badge: "text-blue-600"
      };
    case "purple":
      return {
        bg: "bg-purple-50 dark:bg-purple-950/30",
        text: "text-purple-650",
        badge: "text-purple-650"
      };
    default: // emerald / green
      return {
        bg: "bg-emerald-50 dark:bg-brand-emerald-950/30",
        text: "text-brand-emerald-700",
        badge: "text-brand-emerald-600"
      };
  }
};

export default function WhyChooseUs({ title, subtitle, badge, items }: WhyChooseUsProps) {
  // All display values from CMS props only
  const displayBadge = badge || "";
  const displayTitle = title || "";
  const displaySubtitle = subtitle || "";

  // Items exclusively from CMS; empty array = section renders header only (no crash)
  const activeItems = items && items.length > 0 ? items : [];

  return (
    <section id="pendekatan" className="w-full py-24 bg-background relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
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

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {activeItems.map((item, index) => {
            const Icon = (item.icon && (LucideIcons as any)[item.icon]) || LucideIcons.HelpCircle;
            
            // Determine custom styling fields
            let theme = "emerald";
            let gridWidth = "";
            if (item.custom_fields) {
              const parsed = typeof item.custom_fields === "string" ? JSON.parse(item.custom_fields) : item.custom_fields;
              theme = parsed.theme || "emerald";
              gridWidth = parsed.gridWidth || "";
            }
            
            const themeClasses = getThemeClasses(theme);
            const isLarge = gridWidth === "col-span-2" || gridWidth === "lg:col-span-2";

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
                className={`${
                  isLarge ? "lg:col-span-2" : ""
                } p-8 rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden`}
              >
                <div className="space-y-6">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${themeClasses.bg} ${themeClasses.text}`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-fredoka text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                      {item.title}
                    </h3>
                    {item.subtitle && (
                      <span className={`font-plus-jakarta text-xs font-bold ${themeClasses.badge} uppercase tracking-wider block`}>
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

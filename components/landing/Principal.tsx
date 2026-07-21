"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";

interface PrincipalProps {
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  config?: {
    principal_name?: string;
    principal_title?: string;
    principal_greeting?: string;
    principal_photo?: {
      url: string;
    } | null;
  } | null;
}

export default function Principal({ title, subtitle, badge, config }: PrincipalProps) {
  // Show principal identity only when name is explicitly configured in CMS
  const showPrincipalIdentity = !!config?.principal_name;

  // All display values from CMS props/config only
  const displayBadge = badge || "";
  const displayTitle = title || "";
  
  // Greeting from CMS config; empty string if not yet configured
  const displayGreeting = config?.principal_greeting || subtitle || "";

  // Identity fields — only populated from CMS config, not hardcoded
  const principalName = config?.principal_name || "";
  const principalTitle = config?.principal_title || "";
  const photoUrl = config?.principal_photo?.url || "";

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
                className="relative aspect-3/4 rounded-[28px] overflow-hidden border-4 border-white shadow-xl max-w-sm mx-auto bg-zinc-100 dark:bg-zinc-800"
              >
                {photoUrl && (
                  <Image
                    src={photoUrl}
                    alt={principalName}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                )}
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
                {displayBadge}
              </span>
              <h2 className="font-fredoka text-3xl md:text-4xl font-bold text-zinc-850 dark:text-zinc-150">
                {displayTitle}
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-plus-jakarta text-zinc-655 dark:text-zinc-400 space-y-4 text-base md:text-lg leading-relaxed relative z-10 whitespace-pre-line"
            >
              <p>
                Assalamualaikum Warahmatullahi Wabarakatuh,
              </p>
              {displayGreeting}
            </motion.div>

            {showPrincipalIdentity && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="pt-4"
              >
                <h3 className="font-fredoka text-xl font-bold text-zinc-850 dark:text-zinc-200">
                  {principalName}
                </h3>
                <span className="font-plus-jakarta text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1 block">
                  {principalTitle}
                </span>
              </motion.div>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

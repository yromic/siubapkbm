"use client";

/**
 * MilestoneCelebrationModal — Unified celebration and appreciation modal.
 *
 * Design System Reference:
 *   - Merges components/ui/appreciation-dialog.tsx and components/ui/celebration-modal.tsx
 *   - Preserves backward compatibility via variant prop ("appreciation" vs "celebration")
 */

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, PartyPopper, X } from "lucide-react";
import {
  overlayMotionVariants,
  cardMotionVariants,
  staggerItemVariants,
  iconMicroVariants,
  buttonMotionProps,
} from "@/lib/afs/motion-presets";

export interface MilestoneCelebrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  variant?: "appreciation" | "celebration";
  badgeLabel?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
}

export function MilestoneCelebrationModal({
  open,
  onOpenChange,
  title,
  description,
  variant = "celebration",
  badgeLabel = "Milestone Institusi",
  confirmLabel = "Lanjutkan",
  onConfirm,
}: MilestoneCelebrationModalProps) {
  const shouldReduceMotion = useReducedMotion();

  const handleConfirm = () => {
    onOpenChange(false);
    if (onConfirm) onConfirm();
  };

  const isAppreciation = variant === "appreciation";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                variants={overlayMotionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 z-50 bg-zinc-950/45 backdrop-blur-[2px]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                variants={shouldReduceMotion ? undefined : cardMotionVariants}
                initial={shouldReduceMotion ? { opacity: 0 } : "hidden"}
                animate={shouldReduceMotion ? { opacity: 1 } : "visible"}
                exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
                className={`fixed left-[50%] top-[50%] z-50 grid w-full ${
                  isAppreciation ? "max-w-md" : "max-w-lg"
                } translate-x-[-50%] translate-y-[-50%] gap-4 bg-surface-1 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl focus:outline-none select-none`}
              >
                <Dialog.Close className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors focus:outline-none cursor-pointer">
                  <X className="w-5 h-5" />
                  <span className="sr-only">Tutup</span>
                </Dialog.Close>

                <div className="flex flex-col items-center text-center space-y-4 pt-2">
                  {!isAppreciation && (
                    <motion.div variants={shouldReduceMotion ? undefined : staggerItemVariants}>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-brand-emerald-100 text-brand-emerald-800 dark:bg-brand-emerald-950/60 dark:text-brand-emerald-300 uppercase tracking-wider">
                        {badgeLabel}
                      </span>
                    </motion.div>
                  )}

                  <motion.div
                    variants={shouldReduceMotion ? undefined : iconMicroVariants}
                    className={`flex items-center justify-center shadow-lg border ${
                      isAppreciation
                        ? "w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50"
                        : "w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 border-amber-200/50 dark:border-amber-800/50"
                    }`}
                  >
                    {isAppreciation ? <Sparkles className="w-8 h-8" /> : <PartyPopper className="w-10 h-10" />}
                  </motion.div>

                  <div className="space-y-2">
                    <motion.div variants={shouldReduceMotion ? undefined : staggerItemVariants}>
                      <Dialog.Title
                        className={`${
                          isAppreciation ? "text-xl font-bold" : "text-2xl font-black"
                        } text-zinc-900 dark:text-zinc-50 tracking-tight`}
                      >
                        {title}
                      </Dialog.Title>
                    </motion.div>
                    <motion.div variants={shouldReduceMotion ? undefined : staggerItemVariants}>
                      <Dialog.Description className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                        {description}
                      </Dialog.Description>
                    </motion.div>
                  </div>

                  <motion.div
                    variants={shouldReduceMotion ? undefined : staggerItemVariants}
                    className="w-full pt-2"
                  >
                    <motion.button
                      {...(shouldReduceMotion ? {} : buttonMotionProps)}
                      onClick={handleConfirm}
                      className={`w-full ${
                        isAppreciation ? "py-3 px-4 rounded-2xl" : "py-3.5 px-6 rounded-2xl font-bold"
                      } bg-brand-emerald-600 hover:bg-brand-emerald-700 text-white font-semibold shadow-md transition-colors cursor-pointer`}
                    >
                      {confirmLabel}
                    </motion.button>
                  </motion.div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

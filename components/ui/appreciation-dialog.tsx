"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import {
  overlayMotionVariants,
  cardMotionVariants,
  staggerItemVariants,
  iconMicroVariants,
  buttonMotionProps,
} from "@/lib/afs/motion-presets";

export interface AppreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm?: () => void;
}

export function AppreciationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Lanjutkan",
  onConfirm,
}: AppreciationDialogProps) {
  const shouldReduceMotion = useReducedMotion();

  const handleConfirm = () => {
    onOpenChange(false);
    if (onConfirm) onConfirm();
  };

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
                className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl focus:outline-none select-none"
              >
                <Dialog.Close className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors focus:outline-none cursor-pointer">
                  <X className="w-5 h-5" />
                  <span className="sr-only">Tutup</span>
                </Dialog.Close>

                <div className="flex flex-col items-center text-center space-y-4 pt-2">
                  <motion.div
                    variants={shouldReduceMotion ? undefined : iconMicroVariants}
                    className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner border border-emerald-200/50 dark:border-emerald-800/50"
                  >
                    <Sparkles className="w-8 h-8" />
                  </motion.div>

                  <div className="space-y-2">
                    <motion.div variants={shouldReduceMotion ? undefined : staggerItemVariants}>
                      <Dialog.Title className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                        {title}
                      </Dialog.Title>
                    </motion.div>
                    <motion.div variants={shouldReduceMotion ? undefined : staggerItemVariants}>
                      <Dialog.Description className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
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
                      className="w-full py-3 px-4 bg-[#468432] hover:bg-[#3A6F2B] text-white font-semibold rounded-2xl shadow-md transition-colors cursor-pointer"
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

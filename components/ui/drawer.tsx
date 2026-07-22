"use client";

/**
 * Drawer — Reusable mobile side drawer / sheet overlay component.
 *
 * Design System Reference:
 *   - SIUBA_ADMIN_DESIGN_SPECIFICATION.md §2 (Mobile First Foundation)
 *   - Uses Radix Dialog + Framer Motion backdrop blur
 */

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion, Variants } from "framer-motion";
import { X } from "lucide-react";
import { overlayMotionVariants } from "@/lib/afs/motion-presets";

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  position?: "left" | "right" | "bottom";
  children: React.ReactNode;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  position = "right",
  children,
}: DrawerProps) {
  const shouldReduceMotion = useReducedMotion();

  const getPositionClasses = () => {
    switch (position) {
      case "left":
        return "left-0 top-0 bottom-0 w-80 max-w-[85vw]";
      case "bottom":
        return "left-0 right-0 bottom-0 max-h-[85vh] rounded-t-3xl";
      case "right":
      default:
        return "right-0 top-0 bottom-0 w-80 max-w-[85vw]";
    }
  };

  const drawerMotionVariants: Variants = {
    hidden: {
      x: position === "right" ? "100%" : position === "left" ? "-100%" : "0%",
      y: position === "bottom" ? "100%" : "0%",
      opacity: 0,
    },
    visible: {
      x: "0%",
      y: "0%",
      opacity: 1,
      transition: { type: "spring", damping: 25, stiffness: 250 },
    },
    exit: {
      x: position === "right" ? "100%" : position === "left" ? "-100%" : "0%",
      y: position === "bottom" ? "100%" : "0%",
      opacity: 0,
      transition: { duration: 0.2 },
    },
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
                variants={shouldReduceMotion ? undefined : drawerMotionVariants}
                initial={shouldReduceMotion ? { opacity: 0 } : "hidden"}
                animate={shouldReduceMotion ? { opacity: 1 } : "visible"}
                exit={shouldReduceMotion ? { opacity: 0 } : "exit"}
                className={`fixed z-50 bg-surface-1 border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 flex flex-col focus:outline-none ${getPositionClasses()}`}
              >
                <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                  {title ? (
                    <Dialog.Title className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                      {title}
                    </Dialog.Title>
                  ) : (
                    <div />
                  )}
                  <Dialog.Close className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors focus:outline-none cursor-pointer">
                    <X className="w-5 h-5" />
                    <span className="sr-only">Tutup</span>
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

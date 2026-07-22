import { Variants } from "framer-motion";

/**
 * Standard cubic-bezier ease for premium SaaS interface motion (Linear/Stripe style)
 * Calm, smooth, and natural deceleration with no bounce/overshoot.
 */
export const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Backdrop Overlay Motion Preset
 * Fades overlay smoothly from 0 to 0.45 opacity
 */
export const overlayMotionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2, // 200ms
      ease: "linear",
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.18, // 180ms
      ease: "linear",
    },
  },
};

/**
 * Modal Card Motion Preset (Staged entry & graceful exit)
 */
export const cardMotionVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3, // 300ms
      ease: PREMIUM_EASE,
      staggerChildren: 0.05, // 50ms child stagger
      delayChildren: 0.08, // 80ms delay after overlay starts
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 8,
    transition: {
      duration: 0.18, // 180ms
      ease: PREMIUM_EASE,
    },
  },
};

/**
 * Stagger Child Item Motion Preset
 * Animates headline, body text, badges, and buttons sequentially
 */
export const staggerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.24, // 240ms
      ease: PREMIUM_EASE,
    },
  },
};

/**
 * Icon Welcome Pulse Micro-Interaction Preset
 * Gently scales up to 1.05 once after entrance, then rests. No infinite looping.
 */
export const iconMicroVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: [0.9, 1.05, 1],
    transition: {
      opacity: { duration: 0.24, ease: PREMIUM_EASE },
      scale: { duration: 0.45, times: [0, 0.6, 1], ease: PREMIUM_EASE },
    },
  },
};

/**
 * Primary Action Button Hover & Tap Preset
 */
export const buttonMotionProps = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15, ease: PREMIUM_EASE },
};

import type { Variants } from 'framer-motion';

export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeInOutCubic = [0.65, 0, 0.35, 1] as const;
export const springSmooth = { type: 'spring' as const, stiffness: 200, damping: 25 };
export const springSnappy = { type: 'spring' as const, stiffness: 400, damping: 30 };

export const duration = {
  fast: 0.15,
  base: 0.2,
  slow: 0.4,
} as const;

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base, ease: [...easeOutExpo] } },
};

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.base, ease: [...easeOutExpo] } },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

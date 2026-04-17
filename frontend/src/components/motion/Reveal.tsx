import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { duration, easeOutExpo } from '@/lib/motion/presets';

type MotionTag = keyof typeof motion;

type RevealOwnProps = {
  as?: MotionTag;
  children?: ReactNode;
};

export type RevealProps = RevealOwnProps & Omit<HTMLMotionProps<'div'>, keyof RevealOwnProps>;

export function Reveal({ as, children, className, ...rest }: RevealProps) {
  const reduced = useReducedMotion();
  const Component = motion[as ?? 'div'] as typeof motion.div;

  return (
    <Component
      data-motion="reveal"
      className={className}
      initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={reduced ? undefined : { once: true, margin: '0px 0px -10% 0px' }}
      transition={reduced ? undefined : { duration: duration.base, ease: [...easeOutExpo] }}
      {...rest}
    >
      {children}
    </Component>
  );
}

import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { duration, easeOutExpo } from '@/lib/motion/presets';

type MotionTag = keyof typeof motion;

type FadeInOwnProps = {
  as?: MotionTag;
  children?: ReactNode;
};

export type FadeInProps = FadeInOwnProps & Omit<HTMLMotionProps<'div'>, keyof FadeInOwnProps>;

export function FadeIn({ as, children, className, ...rest }: FadeInProps) {
  const reduced = useReducedMotion();
  const Component = motion[as ?? 'div'] as typeof motion.div;

  return (
    <Component
      data-motion="fade-in"
      className={className}
      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
      whileInView={reduced ? undefined : { opacity: 1 }}
      viewport={reduced ? undefined : { once: true, margin: '0px 0px -10% 0px' }}
      transition={reduced ? undefined : { duration: duration.base, ease: [...easeOutExpo] }}
      {...rest}
    >
      {children}
    </Component>
  );
}

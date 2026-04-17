import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { useMotionDirection } from '@/lib/motion/direction';
import { duration, easeOutExpo } from '@/lib/motion/presets';

type MotionTag = keyof typeof motion;
type Direction = 'top' | 'bottom' | 'start' | 'end';

type SlideInOwnProps = {
  as?: MotionTag;
  from?: Direction;
  distance?: number;
  children?: ReactNode;
};

export type SlideInProps = SlideInOwnProps & Omit<HTMLMotionProps<'div'>, keyof SlideInOwnProps>;

function getOffset(from: Direction, dist: number, dir: 1 | -1): { x: number; y: number } {
  switch (from) {
    case 'top':
      return { x: 0, y: -dist };
    case 'bottom':
      return { x: 0, y: dist };
    case 'start':
      return { x: -dist * dir, y: 0 };
    case 'end':
      return { x: dist * dir, y: 0 };
  }
}

export function SlideIn({
  as,
  from = 'bottom',
  distance = 16,
  children,
  className,
  ...rest
}: SlideInProps) {
  const reduced = useReducedMotion();
  const dir = useMotionDirection();
  const Component = motion[as ?? 'div'] as typeof motion.div;

  const offset = getOffset(from, distance, dir);

  return (
    <Component
      data-motion="slide-in"
      className={className}
      initial={reduced ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset }}
      whileInView={reduced ? undefined : { opacity: 1, x: 0, y: 0 }}
      viewport={reduced ? undefined : { once: true, margin: '0px 0px -10% 0px' }}
      transition={reduced ? undefined : { duration: duration.base, ease: [...easeOutExpo] }}
      {...rest}
    >
      {children}
    </Component>
  );
}

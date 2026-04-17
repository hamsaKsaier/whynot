import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';

type MotionTag = keyof typeof motion;

type StaggerOwnProps = {
  as?: MotionTag;
  delay?: number;
  stagger?: number;
  children?: ReactNode;
};

export type StaggerProps = StaggerOwnProps & Omit<HTMLMotionProps<'div'>, keyof StaggerOwnProps>;

export function Stagger({
  as,
  delay = 0.08,
  stagger = 0.06,
  children,
  className,
  ...rest
}: StaggerProps) {
  const reduced = useReducedMotion();
  const Component = motion[as ?? 'div'] as typeof motion.div;

  return (
    <Component
      data-motion="stagger"
      className={className}
      initial={reduced ? 'visible' : 'hidden'}
      whileInView={reduced ? undefined : 'visible'}
      viewport={reduced ? undefined : { once: true, margin: '0px 0px -10% 0px' }}
      variants={
        reduced
          ? undefined
          : {
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: stagger,
                  delayChildren: delay,
                },
              },
            }
      }
      {...rest}
    >
      {children}
    </Component>
  );
}

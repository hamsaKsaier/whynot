import { type ReactNode, useRef } from 'react';
import { motion, useScroll, useTransform, type HTMLMotionProps } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';

type MotionTag = keyof typeof motion;

type ParallaxOwnProps = {
  as?: MotionTag;
  speed?: number;
  children?: ReactNode;
};

export type ParallaxProps = ParallaxOwnProps & Omit<HTMLMotionProps<'div'>, keyof ParallaxOwnProps>;

export function Parallax({ as, speed = 0.2, children, className, style, ...rest }: ParallaxProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [speed * -100, speed * 100]);

  const Component = motion[as ?? 'div'] as typeof motion.div;

  return (
    <Component
      ref={ref}
      data-motion="parallax"
      className={className}
      style={reduced ? style : { ...style, y }}
      {...rest}
    >
      {children}
    </Component>
  );
}

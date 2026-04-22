import { type ComponentPropsWithoutRef, createElement, useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { duration as presetDuration } from '@/lib/motion/presets';

type CountUpOwnProps = {
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  target: number;
  locale?: string;
  duration?: number;
  formatOptions?: Intl.NumberFormatOptions;
};

export type CountUpProps = CountUpOwnProps &
  Omit<ComponentPropsWithoutRef<'span'>, keyof CountUpOwnProps>;

function format(n: number, locale?: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(n);
}

export function CountUp({
  as = 'span',
  target,
  locale,
  duration: dur = presetDuration.slow,
  formatOptions,
  className,
  ...rest
}: CountUpProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(() =>
    reduced ? format(target, locale, formatOptions) : format(0, locale, formatOptions),
  );

  useEffect(() => {
    if (reduced) {
      setDisplay(format(target, locale, formatOptions));
      return;
    }
    if (!inView) return;

    const controls = animate(0, target, {
      duration: dur,
      onUpdate(value) {
        setDisplay(format(Math.round(value), locale, formatOptions));
      },
    });
    return () => controls.stop();
  }, [inView, target, dur, locale, formatOptions, reduced]);

  return createElement(as, { ref, 'data-motion': 'count-up', className, ...rest }, display);
}

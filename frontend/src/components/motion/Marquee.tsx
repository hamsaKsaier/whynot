import {
  type ReactNode,
  type ComponentPropsWithoutRef,
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion';
import { useMotionDirection } from '@/lib/motion/direction';

type MarqueeOwnProps = {
  as?: 'div' | 'section' | 'aside' | 'nav' | 'ul';
  speed?: number;
  children?: ReactNode;
};

export type MarqueeProps = MarqueeOwnProps &
  Omit<ComponentPropsWithoutRef<'div'>, keyof MarqueeOwnProps>;

export function Marquee({ as = 'div', speed = 30, children, className, ...rest }: MarqueeProps) {
  const reduced = useReducedMotion();
  const dir = useMotionDirection();
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current?.firstElementChild;
    if (el) setContentWidth(el.scrollWidth);
  }, [children]);

  const handlePause = useCallback(() => setPaused(true), []);
  const handleResume = useCallback(() => setPaused(false), []);

  const animDuration = contentWidth > 0 ? contentWidth / speed : 20;
  const direction = dir === -1 ? 'reverse' : 'normal';

  if (reduced) {
    return createElement(
      as,
      { 'data-motion': 'marquee', className, ...rest },
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>{children}</div>,
    );
  }

  return createElement(
    as,
    {
      'data-motion': 'marquee',
      className,
      ref: containerRef,
      onMouseEnter: handlePause,
      onMouseLeave: handleResume,
      onFocusCapture: handlePause,
      onBlurCapture: handleResume,
      style: { overflow: 'hidden' },
      ...rest,
    },
    <>
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation: `marquee-scroll ${animDuration}s linear infinite`,
          animationPlayState: paused ? 'paused' : 'running',
          animationDirection: direction,
        }}
      >
        <div style={{ display: 'flex', flexShrink: 0 }}>{children}</div>
        <div aria-hidden style={{ display: 'flex', flexShrink: 0 }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </>,
  );
}

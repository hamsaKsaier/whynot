import { useRef } from 'react';
import { useInView } from 'framer-motion';

export function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, amount: threshold });
  return { ref, visible };
}

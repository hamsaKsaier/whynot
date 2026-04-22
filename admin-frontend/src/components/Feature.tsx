import type { ReactNode } from 'react';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

interface FeatureProps {
  flag: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function Feature({ flag, fallback = null, children }: FeatureProps) {
  const enabled = useFeatureFlag(flag);
  return <>{enabled ? children : fallback}</>;
}

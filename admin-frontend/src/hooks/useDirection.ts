import { useCallback, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RTL_LANGUAGES, type SupportedLanguage } from '@/i18n';

type Direction = 'ltr' | 'rtl';

function resolveDirection(lang: string): Direction {
  return RTL_LANGUAGES.includes(lang.split('-')[0] as SupportedLanguage) ? 'rtl' : 'ltr';
}

export function useDirection() {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage;
  const [direction, setDirectionState] = useState<Direction>(() => resolveDirection(lang));

  const setDirection = useCallback((dir: Direction) => {
    setDirectionState(dir);
    document.documentElement.setAttribute('dir', dir);
  }, []);

  useLayoutEffect(() => {
    const dir = resolveDirection(lang);
    setDirectionState(dir);
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  return { direction, setDirection, isRtl: direction === 'rtl' };
}

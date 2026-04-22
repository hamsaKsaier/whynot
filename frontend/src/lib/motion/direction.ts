import { useEffect, useState } from 'react';

function getDir(): 'ltr' | 'rtl' {
  if (typeof document === 'undefined') return 'ltr';
  return (document.documentElement.dir as 'ltr' | 'rtl') || 'ltr';
}

export function useMotionDirection(): 1 | -1 {
  const [dir, setDir] = useState<'ltr' | 'rtl'>(getDir);

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setDir(getDir()));
    observer.observe(el, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);

  return dir === 'rtl' ? -1 : 1;
}

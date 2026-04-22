import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { duration, easeOutExpo } from '@/lib/motion/presets'

const STORAGE_KEY = 'landing.stickyCTA.dismissed'
const DISMISS_DAYS = 30

function isDismissedInStorage(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return false
    const daysSince = (Date.now() - new Date(stored).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince < DISMISS_DAYS
  } catch {
    return false
  }
}

export function StickyBottomCTA() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [isVisible, setIsVisible] = useState(false)
  const [dismissed, setDismissed] = useState(() => isDismissedInStorage())

  useEffect(() => {
    if (dismissed) return
    const hero = document.getElementById('hero')
    if (!hero) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [dismissed])

  const handleDismiss = () => {
    setDismissed(true)
    setIsVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {
      /* localStorage unavailable */
    }
  }

  return (
    <AnimatePresence>
      {isVisible && !dismissed && (
        <motion.div
          className="fixed bottom-0 start-0 end-0 z-40 lg:hidden"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: '100%' }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: '100%' }}
          transition={{ duration: duration.base, ease: [...easeOutExpo] }}
          role="region"
          aria-label={t('stickyBottomCTA.ariaLabel')}
        >
          <div
            className="flex items-center justify-between gap-3 bg-primary px-4 py-3 shadow-sm"
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <p className="truncate text-sm font-medium text-primary-foreground">
              {t('stickyBottomCTA.text')}
            </p>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-[44px] min-w-[44px] whitespace-nowrap px-4"
                onClick={() => navigate('/signup')}
              >
                {t('stickyBottomCTA.cta')}
                <ArrowRight className="ms-1 h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
              </Button>

              <button
                onClick={handleDismiss}
                className="flex h-[44px] w-[44px] items-center justify-center text-primary-foreground/70 transition-colors duration-150 hover:text-primary-foreground"
                aria-label={t('stickyBottomCTA.dismiss')}
                type="button"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

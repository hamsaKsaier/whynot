import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function StickyBottomCTA() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || dismissed) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [dismissed])

  const handleDismiss = () => {
    setDismissed(true)
    setIsVisible(false)
  }

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-0 w-0" />

      <div
        className={cn(
          'fixed bottom-0 start-0 end-0 z-40 lg:hidden transition-transform duration-200 pointer-events-none',
          isVisible && !dismissed ? 'translate-y-0' : 'translate-y-[120%]'
        )}
        role="complementary"
        aria-label={t('stickyBottomCTA.ariaLabel')}
      >
        <div
          className="flex items-center justify-between gap-3 bg-primary px-4 py-3 pointer-events-auto shadow-sm"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <p className="text-sm font-medium text-primary-foreground truncate">
            {t('stickyBottomCTA.text')}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-[44px] min-w-[44px] px-4 whitespace-nowrap"
              onClick={() => navigate('/signup')}
            >
              {t('stickyBottomCTA.cta')}
              <ArrowRight
                className="h-4 w-4 ms-1 rtl:scale-x-[-1]"
                aria-hidden="true"
              />
            </Button>

            <button
              onClick={handleDismiss}
              className="flex items-center justify-center h-[44px] w-[44px] text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              aria-label={t('stickyBottomCTA.dismiss')}
              type="button"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

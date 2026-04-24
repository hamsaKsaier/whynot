import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, type PanInfo } from 'framer-motion'
import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { useReducedMotion, useMotionDirection, springSmooth } from '@/lib/motion'
import { Reveal } from '@/components/motion/Reveal'
import { Stagger } from '@/components/motion/Stagger'

interface Testimonial {
  key: string
  initials: string
}

const TESTIMONIALS: Testimonial[] = [
  { key: 'sarah', initials: 'SC' },
  { key: 'marcus', initials: 'MJ' },
  { key: 'elena', initials: 'ER' },
]

const AUTOPLAY_INTERVAL = 6000
const AUTOPLAY_RESUME_DELAY = 10000
const DRAG_THRESHOLD_RATIO = 0.25
const VELOCITY_THRESHOLD = 500

function TestimonialCard({
  testimonial,
  className,
}: {
  testimonial: Testimonial
  className?: string
}) {
  const { t } = useTranslation('landing')

  return (
    <Card
      className={cn(
        'h-full bg-card rounded-lg border hover:border-primary/50 transition-colors duration-150',
        className
      )}
    >
      <CardContent className="p-6 sm:p-8 flex flex-col h-full">
        <Quote className="w-8 h-8 text-primary/20 mb-6 shrink-0" aria-hidden="true" />
        <blockquote className="flex-1 mb-8" style={{ quotes: 'auto' }}>
          <p className="text-base leading-relaxed text-foreground/90 before:content-[open-quote] after:content-[close-quote]">
            {t(`testimonials.items.${testimonial.key}.quote`)}
          </p>
        </blockquote>
        <footer className="flex items-center gap-4 mt-auto">
          <div
            className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0"
            aria-hidden="true"
          >
            {testimonial.initials}
          </div>
          <cite className="not-italic">
            <div className="font-semibold text-foreground text-sm">
              {t(`testimonials.items.${testimonial.key}.author`)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t(`testimonials.items.${testimonial.key}.title`)}
              {', '}
              <span className="text-foreground font-medium">
                {t(`testimonials.items.${testimonial.key}.company`)}
              </span>
            </div>
          </cite>
        </footer>
      </CardContent>
    </Card>
  )
}

function useAutoplay(
  enabled: boolean,
  onTick: () => void,
  isPaused: React.MutableRefObject<boolean>
) {
  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(() => {
      if (!isPaused.current) onTick()
    }, AUTOPLAY_INTERVAL)
    return () => clearInterval(interval)
  }, [enabled, onTick, isPaused])
}

function useVisibilityPause(isPaused: React.MutableRefObject<boolean>) {
  useEffect(() => {
    const handler = () => {
      isPaused.current = document.visibilityState === 'hidden'
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [isPaused])
}

export function TestimonialsSection() {
  const { t } = useTranslation('landing')
  const dir = useMotionDirection()
  const reducedMotion = useReducedMotion()
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const isPaused = useRef(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const slideCount = TESTIMONIALS.length
  const gap = 16
  const slideWidth = containerWidth > 0 ? containerWidth * 0.85 : 0
  const step = slideWidth + gap
  const trackOffset = -currentIndex * step * dir

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % slideCount)
  }, [slideCount])

  const goNextClamped = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, slideCount - 1))
  }, [slideCount])

  const goPrevClamped = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [slideCount])

  const goToSlide = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, slideCount - 1)))
    },
    [slideCount]
  )

  useAutoplay(!reducedMotion, goNext, isPaused)
  useVisibilityPause(isPaused)

  const pauseAutoplay = useCallback(() => {
    isPaused.current = true
  }, [])

  const resumeAutoplay = useCallback(() => {
    isPaused.current = false
  }, [])

  const pauseAndDeferResume = useCallback(() => {
    isPaused.current = true
    clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      isPaused.current = false
    }, AUTOPLAY_RESUME_DELAY)
  }, [])

  useEffect(() => {
    return () => clearTimeout(resumeTimerRef.current)
  }, [])

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const { x: offset } = info.offset
      const { x: velocity } = info.velocity
      const threshold = step * DRAG_THRESHOLD_RATIO

      if (offset * dir < -threshold || velocity * dir < -VELOCITY_THRESHOLD) {
        goNextClamped()
      } else if (offset * dir > threshold || velocity * dir > VELOCITY_THRESHOLD) {
        goPrevClamped()
      }

      pauseAndDeferResume()
    },
    [dir, step, goNextClamped, goPrevClamped, pauseAndDeferResume]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isForward =
        (e.key === 'ArrowRight' && dir === 1) ||
        (e.key === 'ArrowLeft' && dir === -1)
      const isBackward =
        (e.key === 'ArrowLeft' && dir === 1) ||
        (e.key === 'ArrowRight' && dir === -1)

      if (isForward) {
        e.preventDefault()
        goNextClamped()
        pauseAndDeferResume()
      } else if (isBackward) {
        e.preventDefault()
        goPrevClamped()
        pauseAndDeferResume()
      }
    },
    [dir, goNextClamped, goPrevClamped, pauseAndDeferResume]
  )

  const endX = -(slideCount - 1) * step * dir
  const dragConstraints = {
    left: Math.min(0, endX),
    right: Math.max(0, endX),
  }

  return (
    <section
      id="testimonials"
      className="py-16 sm:py-24 md:py-32 bg-background border-y border-border/50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
            {t('testimonials.heading')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground">
            {t('testimonials.subheading')}
          </p>
        </Reveal>

        {/* Mobile / tablet: carousel */}
        <div className="md:hidden">
          <div
            ref={containerRef}
            className="overflow-hidden"
            role="region"
            aria-roledescription="carousel"
            aria-label={t('testimonials.heading')}
            onMouseEnter={pauseAutoplay}
            onMouseLeave={resumeAutoplay}
            onFocusCapture={pauseAutoplay}
            onBlurCapture={resumeAutoplay}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {reducedMotion ? (
              <div
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4"
                role="list"
              >
                {TESTIMONIALS.map((testimonial) => (
                  <div
                    key={testimonial.key}
                    className="min-w-[85vw] snap-center sm:min-w-[60vw]"
                    role="listitem"
                    aria-roledescription="slide"
                  >
                    <TestimonialCard testimonial={testimonial} />
                  </div>
                ))}
              </div>
            ) : (
              <motion.div
                className="flex gap-4"
                drag="x"
                dragConstraints={dragConstraints}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                animate={{ x: trackOffset }}
                transition={springSmooth}
              >
                {TESTIMONIALS.map((testimonial, i) => (
                  <div
                    key={testimonial.key}
                    className="shrink-0"
                    style={{ width: slideWidth || '85vw' }}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={t('testimonials.carousel.goToSlide', {
                      number: i + 1,
                    })}
                  >
                    <TestimonialCard testimonial={testimonial} />
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Dot indicators */}
          <div
            className="flex justify-center gap-2 mt-6"
            role="tablist"
            aria-label={t('testimonials.heading')}
          >
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === currentIndex}
                aria-label={t('testimonials.carousel.goToSlide', {
                  number: i + 1,
                })}
                onClick={() => {
                  goToSlide(i)
                  pauseAndDeferResume()
                }}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors duration-150',
                  i === currentIndex
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30'
                )}
              />
            ))}
          </div>
        </div>

        {/* Desktop: side-by-side grid */}
        <Stagger className="hidden md:grid md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {TESTIMONIALS.map((testimonial) => (
            <Reveal key={testimonial.key}>
              <TestimonialCard testimonial={testimonial} />
            </Reveal>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

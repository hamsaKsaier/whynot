import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CheckCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { Stagger } from '@/components/motion/Stagger'
import { SlideIn } from '@/components/motion/SlideIn'
import { Parallax } from '@/components/motion/Parallax'
import { FadeIn } from '@/components/motion/FadeIn'
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { duration, easeOutExpo } from '@/lib/motion/presets'

const wordVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: [...easeOutExpo] },
  },
}

function parseTitle(raw: string): Array<{ word: string; highlight: boolean }> {
  const words: Array<{ word: string; highlight: boolean }> = []
  let inHighlight = false
  const parts = raw.split(/(<highlight>|<\/highlight>)/)
  for (const part of parts) {
    if (part === '<highlight>') {
      inHighlight = true
      continue
    }
    if (part === '</highlight>') {
      inHighlight = false
      continue
    }
    if (!part.trim()) continue
    for (const word of part.split(/\s+/).filter(Boolean)) {
      words.push({ word, highlight: inHighlight })
    }
  }
  return words
}

export function HeroSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const reduced = useReducedMotion()

  const titleWords = useMemo(() => parseTitle(t('hero.title')), [t])

  const headlineClasses =
    'mt-4 text-2xl font-semibold leading-tight tracking-tight xs:text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl'

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="hero" className="px-4 pb-12 pt-12 sm:px-6 sm:pb-20 sm:pt-20 md:pb-24 md:pt-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-8 md:gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            {reduced ? (
              <span className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {t('hero.eyebrow')}
              </span>
            ) : (
              <FadeIn>
                <span className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {t('hero.eyebrow')}
                </span>
              </FadeIn>
            )}

            {reduced ? (
              <h1 className={headlineClasses}>
                {titleWords.map((item, i) => (
                  <span
                    key={i}
                    className={item.highlight ? 'inline-block text-primary' : 'inline-block'}
                  >
                    {item.word}
                    {i < titleWords.length - 1 ? '\u00A0' : ''}
                  </span>
                ))}
              </h1>
            ) : (
              <Stagger as="h1" stagger={0.06} delay={0.08} className={headlineClasses}>
                {titleWords.map((item, i) => (
                  <motion.span
                    key={i}
                    className={item.highlight ? 'inline-block text-primary' : 'inline-block'}
                    variants={wordVariants}
                  >
                    {item.word}
                    {i < titleWords.length - 1 ? '\u00A0' : ''}
                  </motion.span>
                ))}
              </Stagger>
            )}

            {reduced ? (
                <p className="mt-4 max-w-lg text-sm text-muted-foreground sm:mt-6 sm:text-base md:text-lg">
                {t('hero.subtitle')}
              </p>
            ) : (
              <SlideIn from="bottom" distance={4}>
              <p className="mt-4 max-w-lg text-sm text-muted-foreground sm:mt-6 sm:text-base md:text-lg">
                  {t('hero.subtitle')}
                </p>
              </SlideIn>
            )}

            {reduced ? (
              <div className="mt-6 flex flex-col items-start gap-3 sm:mt-8 sm:flex-row sm:gap-4">
                {isAuthenticated ? (
                  <Button size="lg" onClick={() => navigate('/dashboard')}>
                    {t('nav.openApp')}
                    <ArrowRight className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
                  </Button>
                ) : (
                  <Button size="lg" onClick={() => navigate('/signup')}>
                    {t('hero.cta')}
                    <ArrowRight className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
                  </Button>
                )}
                <Button variant="outline" size="lg" onClick={scrollToPricing}>
                  {t('hero.secondaryCta')}
                </Button>
              </div>
            ) : (
              <SlideIn from="bottom" distance={4}>
                <div className="mt-6 flex flex-col items-start gap-3 sm:mt-8 sm:flex-row sm:gap-4">
                  {isAuthenticated ? (
                    <Button size="lg" onClick={() => navigate('/dashboard')}>
                      {t('nav.openApp')}
                      <ArrowRight className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
                    </Button>
                  ) : (
                    <Button size="lg" onClick={() => navigate('/signup')}>
                      {t('hero.cta')}
                      <ArrowRight className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
                    </Button>
                  )}
                  <Button variant="outline" size="lg" onClick={scrollToPricing}>
                    {t('hero.secondaryCta')}
                  </Button>
                </div>
              </SlideIn>
            )}

            {reduced ? (
              <div className="mt-8 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>{t('hero.noCreditCard')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {['bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500'].map(
                      (bg, i) => (
                        <div
                          key={i}
                          className={`h-6 w-6 rounded-full border-2 border-background ${bg}`}
                        />
                      )
                    )}
                  </div>
                  <span>{t('hero.socialProof')}</span>
                </div>
              </div>
            ) : (
              <motion.div
                className="mt-6 flex flex-col gap-3 sm:mt-8"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{
                  delay: 0.4,
                  duration: duration.base,
                  ease: [...easeOutExpo],
                }}
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>{t('hero.noCreditCard')}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {['bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500'].map(
                      (bg, i) => (
                        <div
                          key={i}
                          className={`h-6 w-6 rounded-full border-2 border-background ${bg}`}
                        />
                      )
                    )}
                  </div>
                  <span>{t('hero.socialProof')}</span>
                </div>
              </motion.div>
            )}
          </div>

          {reduced ? (
            <div className="mx-auto max-w-full overflow-hidden rounded-lg ring-1 ring-border bg-card shadow-sm mt-2 md:mt-0">
              <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 sm:px-4 sm:py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20 sm:h-3 sm:w-3" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20 sm:h-3 sm:w-3" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20 sm:h-3 sm:w-3" />
                <div className="mx-auto h-3 w-24 rounded-md bg-muted-foreground/10 sm:h-4 sm:w-32 md:w-48" />
              </div>
              <div className="relative aspect-video">
                <video
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover"
                  aria-label={t('hero.videoCaption')}
                />
                <div className="absolute inset-0 flex flex-col justify-center space-y-2 p-3 sm:space-y-3 sm:p-4 md:p-8">
                  <div className="h-3 w-3/4 rounded bg-muted-foreground/10 sm:h-4" />
                  <div className="h-3 w-1/2 rounded bg-muted-foreground/10 sm:h-4" />
                  <div className="h-3 w-5/6 rounded bg-muted-foreground/10 sm:h-4" />
                  <div className="mt-3 flex-1 rounded-lg border border-primary/10 bg-primary/5 sm:mt-4 md:mt-6" />
                </div>
              </div>
            </div>
          ) : (
            <Parallax speed={0.15}>
              <div className="mx-auto max-w-full overflow-hidden rounded-lg ring-1 ring-border bg-card shadow-sm mt-2 md:mt-0">
                <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 sm:px-4 sm:py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20 sm:h-3 sm:w-3" />
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20 sm:h-3 sm:w-3" />
                  <div className="mx-auto h-3 w-24 rounded-md bg-muted-foreground/10 sm:h-4 sm:w-32 md:w-48" />
                </div>
                <div className="relative aspect-video">
                  <video
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-cover"
                    aria-label={t('hero.videoCaption')}
                  />
                  <div className="absolute inset-0 flex flex-col justify-center space-y-2 p-3 sm:space-y-3 sm:p-4 md:p-8">
                    <div className="h-3 w-3/4 rounded bg-muted-foreground/10 sm:h-4" />
                    <div className="h-3 w-1/2 rounded bg-muted-foreground/10 sm:h-4" />
                    <div className="h-3 w-5/6 rounded bg-muted-foreground/10 sm:h-4" />
                    <div className="mt-3 flex-1 rounded-lg border border-primary/10 bg-primary/5 sm:mt-4 md:mt-6" />
                  </div>
                </div>
              </div>
            </Parallax>
          )}
        </div>
      </div>
    </section>
  )
}

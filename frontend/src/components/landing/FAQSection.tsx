import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronDown } from 'lucide-react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { cn } from '@/lib/utils'
import { useReducedMotion, duration, easeOutExpo } from '@/lib/motion'
import { Reveal } from '@/components/motion/Reveal'

const FAQ_KEYS = [
  'howItWorks',
  'integration',
  'pricing',
  'security',
  'accuracy',
] as const

type FaqKey = (typeof FAQ_KEYS)[number]

function getFaqKeyFromHash(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash.slice(1)
  if (!hash.startsWith('faq-')) return ''
  const id = hash.replace('faq-', '')
  return FAQ_KEYS.includes(id as FaqKey) ? id : ''
}

function FAQContent({
  isOpen,
  reducedMotion,
  children,
}: {
  isOpen: boolean
  reducedMotion: boolean
  children: React.ReactNode
}) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  height: { duration: duration.base, ease: [...easeOutExpo] },
                  opacity: { duration: duration.fast },
                }
          }
          className="overflow-hidden"
        >
          <div className="pb-4 text-muted-foreground text-base leading-relaxed">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function FAQSection() {
  const { t } = useTranslation('landing')
  const reducedMotion = useReducedMotion()
  const [openItem, setOpenItem] = useState<string>(() => getFaqKeyFromHash())
  const sectionRef = useRef<HTMLElement>(null)
  const hasScrolledRef = useRef(false)

  useEffect(() => {
    const key = getFaqKeyFromHash()
    if (!key || hasScrolledRef.current) return
    hasScrolledRef.current = true
    setOpenItem(key)
    requestAnimationFrame(() => {
      const el = document.getElementById(`faq-${key}`)
      if (el) {
        el.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'center',
        })
      }
    })
  }, [reducedMotion])

  useEffect(() => {
    const handler = () => {
      const key = getFaqKeyFromHash()
      if (key) {
        setOpenItem(key)
        const el = document.getElementById(`faq-${key}`)
        if (el) {
          el.scrollIntoView({
            behavior: reducedMotion ? 'auto' : 'smooth',
            block: 'center',
          })
        }
      }
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [reducedMotion])

  const handleValueChange = useCallback((value: string) => {
    setOpenItem(value)
    if (value) {
      window.history.replaceState(null, '', `#faq-${value}`)
    } else {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      )
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      id="faq"
      className="py-24 sm:py-32 bg-background"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-16">
          <h2
            id="faq-heading"
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
          >
            {t('faq.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('faq.subheading')}
          </p>
        </Reveal>

        <AccordionPrimitive.Root
          type="single"
          collapsible
          value={openItem}
          onValueChange={handleValueChange}
          className="w-full"
        >
          {FAQ_KEYS.map((key) => (
            <AccordionPrimitive.Item
              key={key}
              value={key}
              id={`faq-${key}`}
              className="border-b"
            >
              <AccordionPrimitive.Header className="flex">
                <AccordionPrimitive.Trigger className="flex flex-1 items-center justify-between py-4 text-start text-lg font-medium hover:underline group">
                  {t(`faq.items.${key}.question`)}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150',
                      openItem === key && 'rotate-180'
                    )}
                    aria-hidden="true"
                  />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionPrimitive.Content forceMount asChild>
                <div role="region">
                  <FAQContent isOpen={openItem === key} reducedMotion={reducedMotion}>
                    {t(`faq.items.${key}.answer`)}
                  </FAQContent>
                </div>
              </AccordionPrimitive.Content>
            </AccordionPrimitive.Item>
          ))}
        </AccordionPrimitive.Root>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {t('faq.contactText')}{' '}
            <a
              href="mailto:support@whynot.sh"
              className="font-medium text-primary hover:underline inline-flex items-center"
            >
              {t('faq.contactLink')}
              <ArrowRight className="ms-1 w-4 h-4 rtl:scale-x-[-1]" />
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}

import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ_KEYS = [
  'howItWorks',
  'integration',
  'pricing',
  'security',
  'accuracy',
] as const

export function FAQSection() {
  const { t } = useTranslation('landing')
  const { ref, visible } = useScrollReveal()

  return (
    <section
      className="py-24 sm:py-32 bg-background"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className={cn(
            'text-center mb-16 transition-opacity duration-200',
            visible ? 'opacity-100' : 'opacity-0'
          )}
        >
          <h2
            id="faq-heading"
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
          >
            {t('faq.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('faq.subheading')}
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQ_KEYS.map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="text-start text-lg font-medium">
                {t(`faq.items.${key}.question`)}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                {t(`faq.items.${key}.answer`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

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

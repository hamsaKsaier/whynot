import { useTranslation } from 'react-i18next'
import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { useScrollReveal } from '@/hooks/useScrollReveal'

interface Testimonial {
  key: string
  initials: string
}

const TESTIMONIALS: Testimonial[] = [
  { key: 'sarah', initials: 'SC' },
  { key: 'marcus', initials: 'MJ' },
  { key: 'elena', initials: 'ER' },
]

function TestimonialCard({
  testimonial,
  index,
  visible,
}: {
  testimonial: Testimonial
  index: number
  visible: boolean
}) {
  const { t } = useTranslation('landing')

  return (
    <div
      className={cn(
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      )}
      style={{
        transitionProperty: 'opacity, transform',
        transitionDuration: '200ms',
        transitionDelay: visible ? `${index * 150}ms` : '0ms',
      }}
    >
      <Card className="h-full bg-card rounded-lg border hover:border-primary/50 transition-colors duration-150">
        <CardContent className="p-8 flex flex-col h-full">
          <Quote className="w-8 h-8 text-primary/20 mb-6" />
          <p className="text-base leading-relaxed text-foreground/90 mb-8 flex-1">
            &ldquo;{t(`testimonials.items.${testimonial.key}.quote`)}&rdquo;
          </p>
          <div className="flex items-center gap-4 mt-auto">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {testimonial.initials}
            </div>
            <div>
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function TestimonialsSection() {
  const { t } = useTranslation('landing')
  const { ref, visible } = useScrollReveal(0.1)

  return (
    <section className="py-24 sm:py-32 bg-background border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className={cn(
            'text-center max-w-3xl mx-auto mb-16',
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          )}
          style={{
            transitionProperty: 'opacity, transform',
            transitionDuration: '200ms',
          }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            {t('testimonials.heading')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('testimonials.subheading')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.key}
              testimonial={testimonial}
              index={index}
              visible={visible}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

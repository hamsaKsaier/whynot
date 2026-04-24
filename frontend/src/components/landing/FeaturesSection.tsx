import { useTranslation } from 'react-i18next'
import {
  Bot,
  Bug,
  Eye,
  Code2,
  ShieldAlert,
  Monitor,
  FileStack,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Stagger } from '@/components/motion/Stagger'
import { Reveal } from '@/components/motion/Reveal'

interface Feature {
  id: string
  icon: LucideIcon
}

const FEATURES: Feature[] = [
  { id: 'aiAgents', icon: Bot },
  { id: 'bugDetection', icon: Bug },
  { id: 'visualRegression', icon: Eye },
  { id: 'playwrightGen', icon: Code2 },
  { id: 'chaosTest', icon: ShieldAlert },
  { id: 'multiBrowser', icon: Monitor },
  { id: 'testSuites', icon: FileStack },
  { id: 'security', icon: Lock },
]

function FeatureCard({ feature }: { feature: Feature }) {
  const { t } = useTranslation('landing')
  const tierBadge = t(`features.items.${feature.id}.tierBadge`, { defaultValue: '' })

  return (
    <Reveal
      as="div"
      className={cn(
        'rounded-lg border bg-card p-4 sm:p-6',
        'hover:border-primary/50 transition-colors duration-150',
      )}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors duration-150">
          <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" aria-hidden="true" />
        </div>
        {tierBadge && (
          <Badge variant="outline" className="text-xs">
            {tierBadge}
          </Badge>
        )}
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">
        {t(`features.items.${feature.id}.title`)}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
        {t(`features.items.${feature.id}.description`)}
      </p>
    </Reveal>
  )
}

export function FeaturesSection() {
  const { t } = useTranslation('landing')

  return (
    <section id="features" className="py-16 sm:py-24 md:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal as="div" className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
            {t('features.heading')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
            {t('features.subheading')}
          </p>
        </Reveal>

        <Stagger
          as="div"
          stagger={0.06}
          delay={0.08}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </Stagger>
      </div>
    </section>
  )
}

import { useTranslation } from 'react-i18next'
import {
  Bot,
  Bug,
  Eye,
  Zap,
  Globe,
  TestTube,
  FileCode,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrollReveal } from '@/hooks/useScrollReveal'

interface Feature {
  id: string
  icon: LucideIcon
}

const FEATURES: Feature[] = [
  { id: 'aiAgents', icon: Bot },
  { id: 'bugDetection', icon: Bug },
  { id: 'visualRegression', icon: Eye },
  { id: 'playwrightGen', icon: FileCode },
  { id: 'chaosTest', icon: Zap },
  { id: 'multiBrowser', icon: Globe },
  { id: 'testSuites', icon: TestTube },
  { id: 'security', icon: Shield },
]

function FeatureCard({
  feature,
  index,
  visible,
}: {
  feature: Feature
  index: number
  visible: boolean
}) {
  const { t } = useTranslation('landing')

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-6 hover:border-primary/50 transition-colors duration-150',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      )}
      style={{
        transitionProperty: 'opacity, transform, border-color',
        transitionDuration: '200ms, 200ms, 150ms',
        transitionDelay: visible ? `${index * 80}ms` : '0ms',
      }}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
        <feature.icon className="w-5 h-5 text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">
        {t(`features.items.${feature.id}.title`)}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t(`features.items.${feature.id}.description`)}
      </p>
    </div>
  )
}

export function FeaturesSection() {
  const { t } = useTranslation('landing')
  const { ref, visible } = useScrollReveal()

  return (
    <section id="features" className="py-24 sm:py-32 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className={cn(
            'text-center max-w-3xl mx-auto mb-16 transition-opacity duration-200',
            visible ? 'opacity-100' : 'opacity-0'
          )}
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            {t('features.heading')}
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {t('features.subheading')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              index={index}
              visible={visible}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

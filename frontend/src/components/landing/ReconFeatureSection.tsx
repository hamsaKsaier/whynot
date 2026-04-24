import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, FileSearch, ShieldCheck, Zap, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Reveal } from '@/components/motion/Reveal'
import { Stagger } from '@/components/motion/Stagger'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

interface Benefit {
  id: 'benefit1' | 'benefit2' | 'benefit3'
  icon: LucideIcon
}

const BENEFITS: Benefit[] = [
  { id: 'benefit1', icon: ShieldCheck },
  { id: 'benefit2', icon: FileSearch },
  { id: 'benefit3', icon: Zap },
]

function BenefitCard({ benefit }: { benefit: Benefit }) {
  const { t } = useTranslation('landing')
  return (
    <Reveal
      as="div"
      className={cn(
        'rounded-lg border bg-card p-4 sm:p-6',
        'hover:border-primary/50 transition-colors duration-150',
      )}
    >
      <div className="mb-3 sm:mb-4">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-muted flex items-center justify-center">
          <benefit.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" aria-hidden="true" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">
        {t(`landing.recon.${benefit.id}.title`)}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t(`landing.recon.${benefit.id}.body`)}
      </p>
    </Reveal>
  )
}

export function ReconFeatureSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [sampleOpen, setSampleOpen] = useState(false)

  const handlePrimaryCta = () => {
    navigate(isAuthenticated ? '/recon' : '/signup?ref=recon')
  }

  return (
    <section
      id="recon"
      aria-labelledby="recon-feature-heading"
      className="py-16 sm:py-24 md:py-32 bg-muted/30"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal as="div" className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <Badge variant="outline" className="mb-4 text-xs font-medium">
            {t('landing.recon.eyebrow')}
          </Badge>
          <h2
            id="recon-feature-heading"
            className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight mb-3 sm:mb-4"
          >
            {t('landing.recon.title')}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
            {t('landing.recon.subtitle')}
          </p>
        </Reveal>

        <Stagger
          as="div"
          stagger={0.06}
          delay={0.08}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-12"
        >
          {BENEFITS.map((benefit) => (
            <BenefitCard key={benefit.id} benefit={benefit} />
          ))}
        </Stagger>

        <Reveal
          as="div"
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          <Button size="lg" onClick={handlePrimaryCta}>
            {t('landing.recon.cta.primary')}
            <ArrowRight className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setSampleOpen(true)}
            data-testid="recon-sample-report-trigger"
          >
            {t('landing.recon.cta.secondary')}
          </Button>
        </Reveal>
      </div>

      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('landing.recon.sampleReport.title')}</DialogTitle>
            <DialogDescription>{t('landing.recon.sampleReport.description')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">
              {t('landing.recon.sampleReport.findingTitle')}
            </p>
            <p className="mb-3">{t('landing.recon.sampleReport.findingBody')}</p>
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
              <code>{t('landing.recon.sampleReport.findingSnippet')}</code>
            </pre>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSampleOpen(false)}>
              {t('landing.recon.sampleReport.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

import { useNavigate } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowRight, ArrowDown, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export function HeroSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          <Trans
            i18nKey="hero.title"
            ns="landing"
            components={{ highlight: <span className="text-primary" /> }}
          />
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          {t('hero.subtitle')}
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          {isAuthenticated ? (
            <Button size="lg" onClick={() => navigate('/app')}>
              {t('nav.openApp')}
              <ArrowRight className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => navigate('/signup')}>
              {t('hero.cta')}
              <ArrowRight className="ms-2 h-5 w-5 rtl:scale-x-[-1]" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="lg"
            onClick={() => scrollToSection('features')}
          >
            {t('hero.secondaryCta')}
            <ArrowDown className="ms-2 h-5 w-5" />
          </Button>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span>{t('hero.noCreditCard')}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('hero.socialProof')}
          </p>
        </div>

        {/* Hero illustration placeholder */}
        <div className="mx-auto mt-16 max-w-3xl overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
            <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
            <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
            <div className="mx-auto h-4 w-48 rounded-md bg-muted-foreground/10" />
          </div>
          <div className="p-8">
            <div className="space-y-3">
              <div className="h-4 w-3/4 rounded bg-muted-foreground/10" />
              <div className="h-4 w-1/2 rounded bg-muted-foreground/10" />
              <div className="h-4 w-5/6 rounded bg-muted-foreground/10" />
              <div className="mt-6 h-32 w-full rounded-lg border border-primary/10 bg-primary/5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

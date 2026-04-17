import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { Stagger } from '@/components/motion/Stagger'
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { fadeInVariants } from '@/lib/motion/presets'
import { motion } from 'framer-motion'
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
  type SupportedLanguage,
} from '@/i18n'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function Footer() {
  const { t, i18n } = useTranslation('landing')
  const currentLang = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage
  const year = new Date().getFullYear()
  const reduced = useReducedMotion()

  const handleLanguageChange = useCallback(
    (lang: SupportedLanguage) => {
      i18n.changeLanguage(lang)
      const { dir } = LANGUAGE_META[lang]
      document.documentElement.setAttribute('dir', dir)
      document.documentElement.setAttribute('lang', lang)
    },
    [i18n]
  )

  const columns = [
    {
      title: t('footer.product'),
      links: [
        { label: t('footer.features'), href: '#features' },
        { label: t('footer.pricing'), href: '#pricing' },
        { label: t('footer.changelog'), href: '#' },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.about'), href: '#' },
        { label: t('footer.blog'), href: '#' },
        { label: t('footer.contact'), href: 'mailto:hello@whynot.dev' },
      ],
    },
    {
      title: t('footer.resources'),
      links: [
        { label: t('footer.docs'), href: '#' },
        { label: t('footer.status'), href: '#' },
        { label: t('footer.api'), href: '#' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { label: t('footer.privacy'), href: '#' },
        { label: t('footer.terms'), href: '#' },
        { label: t('footer.security'), href: '#' },
      ],
    },
  ]

  return (
    <footer className="border-t border-border" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Stagger className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <motion.div variants={reduced ? undefined : fadeInVariants}>
            <div className="mb-4 flex items-center gap-2">
              <Logo size="sm" />
              <span className="font-semibold text-foreground">WhyNot</span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('footer.description')}
            </p>
            <div className="mb-4 flex items-center gap-3">
              <a
                href="https://github.com/whynot-dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                aria-label={t('footer.github')}
              >
                <GithubIcon className="h-5 w-5" />
              </a>
              <a
                href="https://x.com/whynot_dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                aria-label={t('footer.twitter')}
              >
                <TwitterIcon className="h-5 w-5" />
              </a>
            </div>

            <div
              className="inline-flex items-center rounded-md border border-border"
              role="radiogroup"
              aria-label={t('nav.changeLanguage')}
            >
              {SUPPORTED_LANGUAGES.map((lang) => {
                const meta = LANGUAGE_META[lang]
                const isActive = currentLang === lang
                return (
                  <button
                    key={lang}
                    role="radio"
                    aria-checked={isActive}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => handleLanguageChange(lang)}
                    className={cn(
                      'px-2 py-1 text-xs transition-colors duration-150',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <span className="me-1">{meta.flag}</span>
                    {lang.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {columns.map((col) => (
            <motion.div key={col.title} variants={reduced ? undefined : fadeInVariants}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => {
                  const isExternal = link.href.startsWith('mailto:')
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          ))}
        </Stagger>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-6 sm:flex-row sm:justify-between">
          <small className="text-xs text-muted-foreground">
            &copy; {year} WhyNot. {t('footer.allRightsReserved')}
          </small>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {t('footer.terms')}
            </a>
            <a href="#" className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {t('footer.privacy')}
            </a>
            <a href="#" className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground">
              {t('footer.security')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

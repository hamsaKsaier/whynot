import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
  type SupportedLanguage,
} from '@/i18n'

export function Footer() {
  const { t, i18n } = useTranslation('landing')
  const currentLang = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage
  const year = new Date().getFullYear()

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang)
    const { dir } = LANGUAGE_META[lang]
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', lang)
  }

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
      title: t('footer.legal'),
      links: [
        { label: t('footer.privacy'), href: '#' },
        { label: t('footer.terms'), href: '#' },
      ],
    },
  ]

  return (
    <footer className="border-t border-border" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <img src="/logo.svg" alt="" className="h-6" aria-hidden="true" />
              <span className="font-semibold text-foreground">WhyNot</span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              {t('footer.description')}
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Globe className="h-4 w-4" />
                  {LANGUAGE_META[currentLang].nativeName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const meta = LANGUAGE_META[lang]
                  return (
                    <DropdownMenuItem
                      key={lang}
                      onClick={() => handleLanguageChange(lang)}
                      className={currentLang === lang ? 'bg-accent' : undefined}
                    >
                      <span className="me-2">{meta.flag}</span>
                      {meta.nativeName}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-center text-xs text-muted-foreground">
            {t('footer.copyright', { year })}
          </p>
        </div>
      </div>
    </footer>
  )
}

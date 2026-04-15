import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
  type SupportedLanguage,
} from '@/i18n'

export function Header() {
  const { t, i18n } = useTranslation('landing')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentLang = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang)
    const { dir } = LANGUAGE_META[lang]
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', lang)
  }

  const scrollToSection = (id: string) => {
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const navLinks = [
    { label: t('nav.features'), id: 'features' },
    { label: t('nav.pricing'), id: 'pricing' },
  ]

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-150',
        isScrolled
          ? 'border-border bg-background'
          : 'border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <a href="/" className="flex items-center gap-2" aria-label="WhyNot">
          <img src="/logo.svg" alt="" className="h-8" aria-hidden="true" />
          <span className="text-lg font-semibold text-foreground">WhyNot</span>
        </a>

        <nav className="hidden items-center gap-6 md:flex" aria-label={t('nav.main')}>
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToSection(link.id)}
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t('nav.changeLanguage')}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
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

          {isAuthenticated ? (
            <Button variant="default" size="sm" onClick={() => navigate('/app')}>
              {t('nav.openApp')}
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
              >
                {t('nav.signIn')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/signup')}
              >
                {t('nav.getStarted')}
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t('nav.menu')}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <nav className="mt-8 flex flex-col gap-4" aria-label={t('nav.main')}>
                {navLinks.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => scrollToSection(link.id)}
                    className="text-start text-base text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    {link.label}
                  </button>
                ))}

                <div className="my-2 border-t border-border" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 text-start text-base text-muted-foreground transition-colors duration-150 hover:text-foreground">
                      <Globe className="h-4 w-4" />
                      {LANGUAGE_META[currentLang].nativeName}
                    </button>
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

                <div className="my-2 border-t border-border" />

                {isAuthenticated ? (
                  <Button
                    variant="default"
                    onClick={() => {
                      setMobileOpen(false)
                      navigate('/app')
                    }}
                  >
                    {t('nav.openApp')}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => {
                        setMobileOpen(false)
                        navigate('/login')
                      }}
                    >
                      {t('nav.signIn')}
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => {
                        setMobileOpen(false)
                        navigate('/signup')
                      }}
                    >
                      {t('nav.getStarted')}
                    </Button>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

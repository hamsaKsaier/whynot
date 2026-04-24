import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, Globe } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
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
import { FadeIn } from '@/components/motion/FadeIn'
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { fadeInVariants, duration } from '@/lib/motion/presets'

const SCROLL_THRESHOLD = 64

const SECTION_IDS = ['features', 'pricing'] as const

export function Header() {
  const { t, i18n } = useTranslation('landing')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const currentLang = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage
  const reduced = useReducedMotion()
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    )

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [])

  const handleLanguageChange = useCallback(
    (lang: SupportedLanguage) => {
      i18n.changeLanguage(lang)
      const { dir } = LANGUAGE_META[lang]
      document.documentElement.setAttribute('dir', dir)
      document.documentElement.setAttribute('lang', lang)
    },
    [i18n]
  )

  const scrollToSection = useCallback(
    (id: string) => {
      setMobileOpen(false)
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    },
    []
  )

  const navLinks = [
    { label: t('nav.features'), id: 'features' },
    { label: t('nav.pricing'), id: 'pricing' },
    { label: t('nav.docs'), id: 'docs', href: '#' },
  ]

  const mobileItemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: duration.base } },
    exit: { opacity: 0, transition: { duration: duration.fast } },
  }

  return (
    <header
      data-scrolled={isScrolled}
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-200',
        isScrolled
          ? 'h-14 border-border bg-background/90 shadow-sm sm:h-16'
          : 'h-16 border-transparent bg-transparent sm:h-20'
      )}
      style={{ transitionProperty: 'background-color, border-color, height' }}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <FadeIn
          as="a"
          className="flex items-center gap-2"
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.base }}
          {...({ href: '/', 'aria-label': 'WhyNot' } as Record<string, string>)}
        >
          <Logo size="md" />
          <span className="text-lg font-semibold text-foreground">WhyNot</span>
        </FadeIn>

        <nav className="hidden items-center gap-6 md:flex" aria-label={t('nav.main')}>
          {navLinks.map((link) =>
            link.href ? (
              <a
                key={link.id}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                data-active={activeSection === link.id || undefined}
                className={cn(
                  'text-sm transition-colors duration-150',
                  activeSection === link.id
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {link.label}
              </button>
            )
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
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
              <AnimatePresence mode="wait">
                {mobileOpen && (
                  <motion.nav
                    className="mt-8 flex flex-col gap-4"
                    aria-label={t('nav.main')}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: reduced ? 0 : 0.06, delayChildren: reduced ? 0 : 0.08 } },
                      exit: {},
                    }}
                  >
                    {navLinks.map((link) => (
                      <motion.div key={link.id} variants={reduced ? undefined : mobileItemVariants}>
                        {link.href ? (
                          <a
                            href={link.href}
                            className="block text-start text-base text-muted-foreground transition-colors duration-150 hover:text-foreground"
                            onClick={() => setMobileOpen(false)}
                          >
                            {link.label}
                          </a>
                        ) : (
                          <button
                            onClick={() => scrollToSection(link.id)}
                            data-active={activeSection === link.id || undefined}
                            className={cn(
                              'text-start text-base transition-colors duration-150',
                              activeSection === link.id
                                ? 'font-medium text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {link.label}
                          </button>
                        )}
                      </motion.div>
                    ))}

                    <motion.div variants={reduced ? undefined : mobileItemVariants} className="my-2 border-t border-border" />

                    <motion.div variants={reduced ? undefined : mobileItemVariants} className="flex items-center gap-2">
                      <ThemeToggle />
                    </motion.div>

                    <motion.div variants={reduced ? undefined : mobileItemVariants}>
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
                    </motion.div>

                    <motion.div variants={reduced ? undefined : mobileItemVariants} className="my-2 border-t border-border" />

                    {isAuthenticated ? (
                      <motion.div variants={reduced ? undefined : mobileItemVariants}>
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={() => {
                            setMobileOpen(false)
                            navigate('/app')
                          }}
                        >
                          {t('nav.openApp')}
                        </Button>
                      </motion.div>
                    ) : (
                      <>
                        <motion.div variants={reduced ? undefined : mobileItemVariants}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              setMobileOpen(false)
                              navigate('/login')
                            }}
                          >
                            {t('nav.signIn')}
                          </Button>
                        </motion.div>
                        <motion.div variants={reduced ? undefined : mobileItemVariants}>
                          <Button
                            variant="default"
                            className="w-full"
                            onClick={() => {
                              setMobileOpen(false)
                              navigate('/signup')
                            }}
                          >
                            {t('nav.getStarted')}
                          </Button>
                        </motion.div>
                      </>
                    )}
                  </motion.nav>
                )}
              </AnimatePresence>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

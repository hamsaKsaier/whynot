import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, LANGUAGE_META } from '@/i18n'

const BASE_URL = 'https://whynot.sh'

const LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ar: 'ar_SA',
  fr: 'fr_FR',
  de: 'de_DE',
  es: 'es_ES',
}

export function SEOHead() {
  const { t, i18n } = useTranslation('landing')
  const lang = i18n.language || 'en'

  useEffect(() => {
    document.title = t('seo.title')

    const setMeta = (name: string, content: string, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, name)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    const setLink = (rel: string, href: string, attrs?: Record<string, string>) => {
      const selector = attrs
        ? `link[rel="${rel}"]${Object.entries(attrs).map(([k, v]) => `[${k}="${v}"]`).join('')}`
        : `link[rel="${rel}"]`
      let el = document.querySelector(selector) as HTMLLinkElement | null
      if (!el) {
        el = document.createElement('link')
        el.rel = rel
        if (attrs) {
          for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v)
          }
        }
        document.head.appendChild(el)
      }
      el.href = href
    }

    setMeta('description', t('seo.description'))
    setMeta('keywords', t('seo.keywords'))

    setMeta('og:title', t('seo.title'), 'property')
    setMeta('og:description', t('seo.description'), 'property')
    setMeta('og:type', 'website', 'property')
    setMeta('og:url', BASE_URL, 'property')
    setMeta('og:image', `${BASE_URL}/og/${lang}.png`, 'property')
    setMeta('og:locale', LOCALE_MAP[lang] ?? lang, 'property')
    setMeta('og:site_name', 'WhyNot', 'property')

    document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((el) => el.remove())
    for (const supportedLang of SUPPORTED_LANGUAGES) {
      if (supportedLang === lang) continue
      setMeta(`og:locale:alternate-${supportedLang}`, LOCALE_MAP[supportedLang] ?? supportedLang, 'property')
      const el = document.querySelector(`meta[property="og:locale:alternate-${supportedLang}"]`)
      if (el) {
        el.setAttribute('property', 'og:locale:alternate')
        el.setAttribute('content', LOCALE_MAP[supportedLang] ?? supportedLang)
      }
    }

    setMeta('twitter:card', 'summary_large_image', 'name')
    setMeta('twitter:site', '@whynotqa', 'name')
    setMeta('twitter:title', t('seo.title'), 'name')
    setMeta('twitter:description', t('seo.description'), 'name')
    setMeta('twitter:image', `${BASE_URL}/og/${lang}.png`, 'name')

    setLink('canonical', BASE_URL)

    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())

    for (const supportedLang of SUPPORTED_LANGUAGES) {
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = supportedLang
      link.href = `${BASE_URL}/?lng=${supportedLang}`
      document.head.appendChild(link)
    }

    const xDefault = document.createElement('link')
    xDefault.rel = 'alternate'
    xDefault.hreflang = 'x-default'
    xDefault.href = BASE_URL
    document.head.appendChild(xDefault)

    document.documentElement.lang = lang
    document.documentElement.dir = LANGUAGE_META[lang as keyof typeof LANGUAGE_META]?.dir ?? 'ltr'

    return () => {
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())
      document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((el) => el.remove())
    }
  }, [lang, t])

  return null
}

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, LANGUAGE_META } from '@/i18n'

const BASE_URL = 'https://whynot.sh'

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

    setMeta('description', t('seo.description'))
    setMeta('keywords', t('seo.keywords'))

    setMeta('og:title', t('seo.title'), 'property')
    setMeta('og:description', t('seo.description'), 'property')
    setMeta('og:type', 'website', 'property')
    setMeta('og:url', `${BASE_URL}/?lang=${lang}`, 'property')
    setMeta('og:image', `${BASE_URL}/og/${lang}.png`, 'property')
    setMeta('og:locale', lang, 'property')
    setMeta('og:site_name', 'WhyNot', 'property')

    setMeta('twitter:card', 'summary_large_image', 'name')
    setMeta('twitter:title', t('seo.title'), 'name')
    setMeta('twitter:description', t('seo.description'), 'name')
    setMeta('twitter:image', `${BASE_URL}/og/${lang}.png`, 'name')

    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())

    for (const supportedLang of SUPPORTED_LANGUAGES) {
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = supportedLang
      link.href = `${BASE_URL}/?lang=${supportedLang}`
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
    }
  }, [lang, t])

  return null
}

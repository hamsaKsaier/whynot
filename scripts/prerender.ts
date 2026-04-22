import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const DIST = resolve(__dirname, '../frontend/dist')
const LOCALES = ['en', 'ar', 'fr', 'de', 'es'] as const
const PUBLIC_ROUTES = ['/', '/login', '/signup']

type LocaleMeta = { title: string; description: string; dir: string }

const LOCALE_META: Record<string, Record<string, LocaleMeta>> = {
  '/': {
    en: {
      title: 'WhyNot — AI-Powered QA',
      description: 'Autonomous AI agents that explore your web app, find bugs, and generate Playwright test code — so you can ship with confidence.',
      dir: 'ltr',
    },
    ar: {
      title: 'WhyNot — ضمان الجودة بالذكاء الاصطناعي',
      description: 'وكلاء ذكاء اصطناعي مستقلون يستكشفون تطبيقك، ويكتشفون الأخطاء، ويولدون أكواد اختبار Playwright.',
      dir: 'rtl',
    },
    fr: {
      title: 'WhyNot — QA Propulsé par l\'IA',
      description: 'Des agents IA autonomes qui explorent votre application, détectent les bugs et génèrent du code de test Playwright.',
      dir: 'ltr',
    },
    de: {
      title: 'WhyNot — KI-gestützte QA',
      description: 'Autonome KI-Agenten, die Ihre Web-App erkunden, Fehler finden und Playwright-Testcode generieren.',
      dir: 'ltr',
    },
    es: {
      title: 'WhyNot — QA Impulsado por IA',
      description: 'Agentes de IA autónomos que exploran tu aplicación, encuentran errores y generan código de prueba Playwright.',
      dir: 'ltr',
    },
  },
  '/login': {
    en: { title: 'Log In — WhyNot', description: 'Log in to your WhyNot account to manage AI-powered QA sessions and test results.', dir: 'ltr' },
    ar: { title: 'تسجيل الدخول — WhyNot', description: 'سجّل الدخول إلى حسابك في WhyNot لإدارة جلسات ضمان الجودة ونتائج الاختبار.', dir: 'rtl' },
    fr: { title: 'Connexion — WhyNot', description: 'Connectez-vous à votre compte WhyNot pour gérer vos sessions QA et résultats de test.', dir: 'ltr' },
    de: { title: 'Anmelden — WhyNot', description: 'Melden Sie sich bei Ihrem WhyNot-Konto an, um KI-gestützte QA-Sitzungen und Testergebnisse zu verwalten.', dir: 'ltr' },
    es: { title: 'Iniciar sesión — WhyNot', description: 'Inicia sesión en tu cuenta de WhyNot para gestionar sesiones de QA y resultados de pruebas.', dir: 'ltr' },
  },
  '/signup': {
    en: { title: 'Sign Up — WhyNot', description: 'Create a free WhyNot account and start finding bugs with autonomous AI agents.', dir: 'ltr' },
    ar: { title: 'إنشاء حساب — WhyNot', description: 'أنشئ حسابًا مجانيًا في WhyNot وابدأ في اكتشاف الأخطاء مع وكلاء الذكاء الاصطناعي.', dir: 'rtl' },
    fr: { title: 'Créer un compte — WhyNot', description: 'Créez un compte WhyNot gratuit et commencez à trouver des bugs avec des agents IA autonomes.', dir: 'ltr' },
    de: { title: 'Registrieren — WhyNot', description: 'Erstellen Sie ein kostenloses WhyNot-Konto und finden Sie Fehler mit autonomen KI-Agenten.', dir: 'ltr' },
    es: { title: 'Registrarse — WhyNot', description: 'Crea una cuenta gratuita en WhyNot y empieza a encontrar errores con agentes de IA autónomos.', dir: 'ltr' },
  },
}

const BASE_URL = process.env.SITE_URL || 'https://whynot.sh'

function routeToFilename(route: string): string {
  if (route === '/') return 'index'
  return route.replace(/^\//, '').replace(/\//g, '-')
}

function buildUrl(route: string, locale: string): string {
  if (locale === 'en') return `${BASE_URL}${route}`
  const sep = route.includes('?') ? '&' : '?'
  return `${BASE_URL}${route}${sep}lng=${locale}`
}

function buildHreflangs(route: string): string {
  const links = LOCALES.map(
    (loc) => `    <link rel="alternate" hreflang="${loc}" href="${buildUrl(route, loc)}" />`
  )
  links.push(`    <link rel="alternate" hreflang="x-default" href="${buildUrl(route, 'en')}" />`)
  return links.join('\n')
}

function generateHtml(template: string, locale: string, route: string): string {
  const meta = LOCALE_META[route]?.[locale] ?? LOCALE_META['/'][locale]
  const canonical = buildUrl(route, locale)

  let html = template
    .replace(/lang="en"/, `lang="${locale}"`)
    .replace(/dir="ltr"/, `dir="${meta.dir}"`)
    .replace(/<title>.*?<\/title>/, `<title>${meta.title}</title>`)
    .replace(
      /name="description" content=".*?"/,
      `name="description" content="${meta.description}"`
    )
    .replace(
      /property="og:title" content=".*?"/,
      `property="og:title" content="${meta.title}"`
    )
    .replace(
      /property="og:description" content=".*?"/,
      `property="og:description" content="${meta.description}"`
    )
    .replace(
      /property="og:url" content=".*?"/,
      `property="og:url" content="${canonical}"`
    )
    .replace(
      /name="twitter:title" content=".*?"/,
      `name="twitter:title" content="${meta.title}"`
    )
    .replace(
      /name="twitter:description" content=".*?"/,
      `name="twitter:description" content="${meta.description}"`
    )
    .replace(
      /rel="canonical" href=".*?"/,
      `rel="canonical" href="${canonical}"`
    )

  // Replace hreflang block with route-specific URLs
  html = html.replace(
    /\s*<!-- hreflang -->[\s\S]*?<link rel="alternate" hreflang="x-default"[^>]*\/>/,
    `\n    <!-- hreflang -->\n${buildHreflangs(route)}`
  )

  return html
}

const template = readFileSync(resolve(DIST, 'index.html'), 'utf-8')
let fileCount = 0

for (const locale of LOCALES) {
  const localeDir = resolve(DIST, locale)
  mkdirSync(localeDir, { recursive: true })

  for (const route of PUBLIC_ROUTES) {
    const filename = routeToFilename(route)
    const html = generateHtml(template, locale, route)
    const outPath = resolve(localeDir, `${filename}.html`)
    writeFileSync(outPath, html, 'utf-8')
    fileCount++
  }
}

console.log(`Prerendered ${fileCount} HTML files across ${LOCALES.length} locales`)

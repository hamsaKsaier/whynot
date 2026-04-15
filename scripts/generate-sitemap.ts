import { writeFileSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = process.env.SITE_URL || 'https://whynot.sh'
const LOCALES = ['en', 'ar', 'fr', 'de', 'es'] as const
const DEFAULT_LOCALE = 'en'

const PUBLIC_ROUTES = ['/', '/login', '/signup']

function buildUrl(route: string, locale: string): string {
  if (locale === DEFAULT_LOCALE) return `${BASE_URL}${route}`
  const separator = route.includes('?') ? '&' : '?'
  return `${BASE_URL}${route}${separator}lng=${locale}`
}

function generateSitemap(): string {
  const urls: string[] = []

  for (const route of PUBLIC_ROUTES) {
    const hreflangs = LOCALES.map(
      (loc) =>
        `      <xhtml:link rel="alternate" hreflang="${loc}" href="${buildUrl(route, loc)}" />`
    )
    hreflangs.push(
      `      <xhtml:link rel="alternate" hreflang="x-default" href="${buildUrl(route, DEFAULT_LOCALE)}" />`
    )

    for (const locale of LOCALES) {
      urls.push(`    <url>
      <loc>${buildUrl(route, locale)}</loc>
      <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
      <changefreq>${route === '/' ? 'weekly' : 'monthly'}</changefreq>
      <priority>${route === '/' ? '1.0' : '0.6'}</priority>
${hreflangs.join('\n')}
    </url>`)
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
${urls.join('\n')}
</urlset>
`
}

const sitemap = generateSitemap()
const outPath = resolve(__dirname, '../frontend/public/sitemap.xml')
writeFileSync(outPath, sitemap, 'utf-8')
console.log(`Sitemap written to ${outPath} (${PUBLIC_ROUTES.length * LOCALES.length} URLs)`)

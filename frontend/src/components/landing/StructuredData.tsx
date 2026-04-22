import { useTranslation } from 'react-i18next'

const FAQ_KEYS = ['howItWorks', 'integration', 'pricing', 'security', 'accuracy'] as const

const BASE_URL = 'https://whynot.sh'

function useStructuredData() {
  const { t, i18n } = useTranslation('landing')
  const lang = i18n.language || 'en'

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'WhyNot',
    url: BASE_URL,
    logo: `${BASE_URL}/logo-light.svg`,
    description: t('footer.description'),
    sameAs: [
      'https://github.com/whynot-dev',
      'https://x.com/whynot_dev',
    ],
  }

  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'WhyNot',
    description: t('seo.description'),
    url: BASE_URL,
    brand: {
      '@type': 'Organization',
      name: 'WhyNot',
    },
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        name: t('pricing.plans.free.name'),
        description: t('pricing.plans.free.description'),
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        price: '29',
        priceCurrency: 'USD',
        name: t('pricing.plans.pro_byo.name'),
        description: t('pricing.plans.pro_byo.description'),
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        price: '49',
        priceCurrency: 'USD',
        name: t('pricing.plans.pro_managed.name'),
        description: t('pricing.plans.pro_managed.description'),
        availability: 'https://schema.org/InStock',
      },
    ],
  }

  const webSite = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'WhyNot',
    url: BASE_URL,
    inLanguage: lang,
  }

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_KEYS.map((key) => ({
      '@type': 'Question',
      name: t(`faq.items.${key}.question`),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(`faq.items.${key}.answer`),
      },
    })),
  }

  return { organization, product, webSite, faqPage }
}

export function StructuredData() {
  const { organization, product, webSite, faqPage } = useStructuredData()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSite) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  )
}

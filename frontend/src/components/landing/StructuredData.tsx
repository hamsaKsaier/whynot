import { useTranslation } from 'react-i18next'

const FAQ_KEYS = ['howItWorks', 'integration', 'pricing', 'security', 'accuracy'] as const

function useStructuredData() {
  const { t, i18n } = useTranslation('landing')
  const lang = i18n.language || 'en'
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://whynot.sh'

  const webApplication = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'WhyNot',
    description: t('hero.subtitle'),
    url: baseUrl,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    inLanguage: lang,
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        name: t('pricing.plans.free.name'),
        description: t('pricing.plans.free.description'),
      },
      {
        '@type': 'Offer',
        price: '29',
        priceCurrency: 'USD',
        name: t('pricing.plans.pro_byo.name'),
        description: t('pricing.plans.pro_byo.description'),
      },
      {
        '@type': 'Offer',
        price: '49',
        priceCurrency: 'USD',
        name: t('pricing.plans.pro_managed.name'),
        description: t('pricing.plans.pro_managed.description'),
      },
    ],
  }

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'WhyNot',
    url: baseUrl,
    logo: `${baseUrl}/logo.svg`,
    description: t('footer.description'),
    sameAs: [],
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

  return { webApplication, organization, faqPage }
}

export function StructuredData() {
  const { webApplication, organization, faqPage } = useStructuredData()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplication) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
    </>
  )
}

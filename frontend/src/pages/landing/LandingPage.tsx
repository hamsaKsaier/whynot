import { lazy, Suspense } from 'react'
import { Header } from '@/components/landing/Header'
import { HeroSection } from '@/components/landing/HeroSection'
import { TrustBar } from '@/components/landing/TrustBar'
import { SEOHead } from '@/components/landing/SEOHead'

const FeaturesSection = lazy(() =>
  import('@/components/landing/FeaturesSection').then((m) => ({ default: m.FeaturesSection }))
)
const ComparisonSection = lazy(() =>
  import('@/components/landing/ComparisonSection').then((m) => ({ default: m.ComparisonSection }))
)
const TestimonialsSection = lazy(() =>
  import('@/components/landing/TestimonialsSection').then((m) => ({ default: m.TestimonialsSection }))
)
const PricingSection = lazy(() =>
  import('@/components/landing/PricingSection').then((m) => ({ default: m.PricingSection }))
)
const PaygPricingSection = lazy(() =>
  import('@/components/landing/PaygPricingSection').then((m) => ({ default: m.PaygPricingSection }))
)
const FAQSection = lazy(() =>
  import('@/components/landing/FAQSection').then((m) => ({ default: m.FAQSection }))
)
const CTASection = lazy(() =>
  import('@/components/landing/CTASection').then((m) => ({ default: m.CTASection }))
)
const StickyBottomCTA = lazy(() =>
  import('@/components/landing/StickyBottomCTA').then((m) => ({ default: m.StickyBottomCTA }))
)
const StructuredData = lazy(() =>
  import('@/components/landing/StructuredData').then((m) => ({ default: m.StructuredData }))
)
const Footer = lazy(() =>
  import('@/components/landing/Footer').then((m) => ({ default: m.Footer }))
)

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead />
      <Header />
      <main id="main-content">
        <HeroSection />
        <TrustBar />
        <Suspense fallback={null}>
          <FeaturesSection />
          <ComparisonSection />
          <PricingSection />
          <PaygPricingSection />
          <TestimonialsSection />
          <FAQSection />
          <CTASection />
          <StickyBottomCTA />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <StructuredData />
        <Footer />
      </Suspense>
    </div>
  )
}

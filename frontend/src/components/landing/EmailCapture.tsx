import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type EmailCaptureVariant = 'inline' | 'hero' | 'modal'
type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

interface EmailCaptureProps {
  variant?: EmailCaptureVariant
  ctaText?: string
  placeholder?: string
  className?: string
  source?: string
}

export function EmailCapture({
  variant = 'inline',
  ctaText,
  placeholder,
  className,
  source = 'landing',
}: EmailCaptureProps) {
  const { t, i18n } = useTranslation('landing')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setErrorMessage('')

      if (!email || !email.includes('@')) {
        setErrorMessage(t('emailCapture.invalidEmail'))
        return
      }

      setStatus('loading')

      try {
        const res = await fetch('/api/landing/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source, metadata: {} }),
        })

        if (res.status === 400) {
          setErrorMessage(t('emailCapture.invalidEmail'))
          setStatus('error')
          return
        }

        if (res.status === 429) {
          setErrorMessage(t('emailCapture.rateLimited'))
          setStatus('error')
          return
        }

        if (!res.ok) {
          throw new Error('Failed')
        }

        setStatus('success')
        setEmail('')
      } catch {
        setStatus('error')
        setErrorMessage(t('emailCapture.error'))
      }
    },
    [email, source, t]
  )

  if (status === 'success') {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 p-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400',
          className
        )}
        role="alert"
      >
        <Check className="h-5 w-5" aria-hidden="true" />
        <span className="font-medium">{t('emailCapture.success')}</span>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex gap-3',
        variant === 'hero'
          ? 'flex-col sm:flex-row max-w-md mx-auto'
          : 'flex-col sm:flex-row',
        className
      )}
      noValidate
    >
      <div className="relative flex-1">
        <Mail
          className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="email"
          placeholder={placeholder ?? t('emailCapture.placeholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={cn(
            'ps-10 h-12 text-base',
            errorMessage && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-label={t('emailCapture.ariaLabel')}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? 'email-error' : undefined}
          disabled={status === 'loading'}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-12 px-6 min-w-[44px] whitespace-nowrap"
        disabled={status === 'loading'}
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin me-2" aria-hidden="true" />
            {t('emailCapture.sending')}
          </>
        ) : (
          ctaText ?? t('emailCapture.cta')
        )}
      </Button>

      {errorMessage && (
        <p
          id="email-error"
          className="text-sm text-destructive mt-1 col-span-full"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </form>
  )
}

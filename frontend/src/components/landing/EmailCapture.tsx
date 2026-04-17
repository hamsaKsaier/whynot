import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Loader2, Check, ArrowRight, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useReducedMotion } from '@/lib/motion/prefers-reduced-motion'
import { duration, easeOutExpo } from '@/lib/motion/presets'

type EmailCaptureVariant = 'inline' | 'hero' | 'modal'
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error' | 'rate-limited'

interface EmailCaptureProps {
  variant?: EmailCaptureVariant
  ctaText?: string
  placeholder?: string
  className?: string
  source?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_COOLDOWN = 60

export function EmailCapture({
  variant = 'inline',
  ctaText,
  placeholder,
  className,
  source = 'landing',
}: EmailCaptureProps) {
  const { t } = useTranslation('landing')
  const reduced = useReducedMotion()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [validationError, setValidationError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const submissionTimestamps = useRef<number[]>([])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStatus('idle')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const validateEmail = useCallback(
    (value: string): string => {
      if (!value) return ''
      if (!EMAIL_RE.test(value)) return t('emailCapture.invalidEmail')
      return ''
    },
    [t]
  )

  const handleBlur = useCallback(() => {
    if (email) {
      setValidationError(validateEmail(email))
    }
  }, [email, validateEmail])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setErrorMessage('')
      setValidationError('')

      const emailError = validateEmail(email)
      if (emailError) {
        setValidationError(emailError)
        return
      }

      const now = Date.now()
      submissionTimestamps.current = submissionTimestamps.current.filter(
        (ts) => now - ts < RATE_LIMIT_WINDOW
      )
      if (submissionTimestamps.current.length >= RATE_LIMIT_MAX) {
        setStatus('rate-limited')
        setCountdown(RATE_LIMIT_COOLDOWN)
        return
      }
      submissionTimestamps.current.push(now)

      setStatus('submitting')

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
          setStatus('rate-limited')
          setCountdown(RATE_LIMIT_COOLDOWN)
          return
        }

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.message ?? 'Failed')
        }

        setStatus('success')
        setEmail('')
      } catch (err) {
        setStatus('error')
        setErrorMessage(
          err instanceof Error && err.message !== 'Failed'
            ? err.message
            : t('emailCapture.error')
        )
      }
    },
    [email, source, t, validateEmail]
  )

  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: duration.fast, ease: [...easeOutExpo] },
      }

  const displayError = validationError || errorMessage

  return (
    <div className={cn('relative', className)} aria-live="polite">
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            layout={!reduced}
            {...motionProps}
            className="flex items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-600 dark:text-green-400"
            role="alert"
          >
            <Check className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">{t('emailCapture.success')}</span>
          </motion.div>
        ) : status === 'rate-limited' ? (
          <motion.div
            key="rate-limited"
            layout={!reduced}
            {...motionProps}
            className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400"
            role="alert"
          >
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-medium">
              {countdown > 0
                ? t('emailCapture.rateLimitedCountdown', { seconds: countdown })
                : t('emailCapture.rateLimited')}
            </span>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            layout={!reduced}
            {...motionProps}
            onSubmit={handleSubmit}
            className={cn(
              'flex gap-3',
              variant === 'hero' ? 'mx-auto max-w-md flex-col sm:flex-row' : 'flex-col sm:flex-row'
            )}
            noValidate
          >
            <div className="relative flex-1">
              <Mail
                className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="email"
                placeholder={placeholder ?? t('emailCapture.placeholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (validationError) setValidationError('')
                  if (errorMessage) setErrorMessage('')
                }}
                onBlur={handleBlur}
                required
                className={cn(
                  'h-12 ps-10 text-base',
                  displayError && 'border-destructive focus-visible:ring-destructive'
                )}
                aria-label={t('emailCapture.ariaLabel')}
                aria-invalid={!!displayError}
                aria-describedby={displayError ? 'email-error' : undefined}
                disabled={status === 'submitting'}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-12 min-w-[44px] whitespace-nowrap px-6"
              disabled={status === 'submitting' || !EMAIL_RE.test(email)}
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="me-2 h-5 w-5 animate-spin" aria-hidden="true" />
                  {t('emailCapture.sending')}
                </>
              ) : (
                <>
                  {ctaText ?? t('emailCapture.cta')}
                  <ArrowRight className="ms-2 h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
                </>
              )}
            </Button>

            {displayError && (
              <p
                id="email-error"
                className="col-span-full mt-1 text-sm text-destructive"
                role="alert"
              >
                {displayError}
              </p>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

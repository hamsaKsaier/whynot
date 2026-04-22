import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Shield, Loader2 } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Alert, AlertDescription } from '../components/ui/alert'
import { useAuth } from '../contexts/AuthContext'
import { isSuperadminHostname } from '../lib/hostname'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(isSuperadminHostname() ? '/users' : '/')
    } catch (err: any) {
      if (err.message === 'superadmin_required') {
        setError(t('auth.login.accessDenied'))
      } else {
        setError(err.message || t('auth.login.failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center space-y-2 p-4 sm:p-6">
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-semibold">{t('auth.login.title')}</h1>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.login.email')}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                enterKeyHint="next"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t('auth.login.emailPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.login.password')}</Label>
              <Input
                id="password"
                type="password"
                enterKeyHint="done"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder={t('auth.login.passwordPlaceholder')}
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 me-1.5 animate-spin" />}
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center p-4 sm:p-6 pt-0 sm:pt-0">
          <p className="text-xs text-muted-foreground">
            {t('auth.login.superadminOnly')}
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export { LoginPage as default }

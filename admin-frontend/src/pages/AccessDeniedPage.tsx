import { useTranslation } from 'react-i18next'
import { ShieldOff } from 'lucide-react'
import { Button } from '../components/ui/button'
import { getAdminUrl } from '../lib/hostname'

export function AccessDeniedPage() {
  const { t } = useTranslation('common')

  const handleRedirect = () => {
    window.location.href = getAdminUrl()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm mx-auto space-y-4">
        <ShieldOff className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-semibold">{t('admin.errors.accessDenied.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.errors.accessDenied.description')}</p>
        <Button onClick={handleRedirect}>
          {t('admin.errors.accessDenied.goToAdmin')}
        </Button>
      </div>
    </div>
  )
}

export { AccessDeniedPage as default }

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldOff } from 'lucide-react'
import { Button } from '../components/ui/button'

export function ForbiddenPage() {
  const { t } = useTranslation('common')

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm mx-auto space-y-4">
        <ShieldOff className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-semibold">{t('admin.errors.forbidden.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.errors.forbidden.description')}</p>
        <Button asChild>
          <Link to="/login">{t('admin.errors.backToLogin')}</Link>
        </Button>
      </div>
    </div>
  )
}

export { ForbiddenPage as default }

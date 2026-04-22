import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileQuestion } from 'lucide-react'
import { Button } from '../components/ui/button'

export function NotFoundPage() {
  const { t } = useTranslation('common')

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm mx-auto space-y-4">
        <FileQuestion className="h-12 w-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-semibold">{t('admin.errors.notFound.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('admin.errors.notFound.description')}</p>
        <Button asChild>
          <Link to="/">{t('admin.errors.backHome')}</Link>
        </Button>
      </div>
    </div>
  )
}

export { NotFoundPage as default }

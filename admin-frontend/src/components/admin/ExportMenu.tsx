import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

interface ExportMenuProps {
  onExportCSV?: () => void
  onExportJSON?: () => void
  disabled?: boolean
}

export function ExportMenu({ onExportCSV, onExportJSON, disabled }: ExportMenuProps) {
  const { t } = useTranslation('common')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 me-1.5" />
          {t('admin.common.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportCSV && <DropdownMenuItem onClick={onExportCSV}>{t('admin.common.exportCSV')}</DropdownMenuItem>}
        {onExportJSON && <DropdownMenuItem onClick={onExportJSON}>{t('admin.common.exportJSON')}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

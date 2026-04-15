import { useTranslation } from 'react-i18next'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface BulkAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface BulkActionsProps {
  selectedCount: number
  actions: BulkAction[]
  onClear: () => void
  className?: string
}

export function BulkActions({ selectedCount, actions, onClear, className }: BulkActionsProps) {
  const { t } = useTranslation('common')
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-3',
        className
      )}
    >
      <span className="text-sm font-medium">
        {t('admin.common.selected', { count: selectedCount })}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {t('admin.common.actions')}
            <ChevronDown className="h-4 w-4 ms-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={action.onClick}
              className={cn(action.variant === 'destructive' && 'text-destructive')}
            >
              {action.icon && <span className="me-2">{action.icon}</span>}
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="h-4 w-4 me-1" />
        {t('admin.common.clear')}
      </Button>
    </div>
  )
}

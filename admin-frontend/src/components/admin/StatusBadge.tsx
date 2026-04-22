import { useTranslation } from 'react-i18next'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

type Status = 'active' | 'trialing' | 'paused' | 'past_due' | 'canceled' | 'banned' | 'expired' | 'suspended' | string

const statusStyles: Record<string, string> = {
  active: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  trialing: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  paused: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800',
  past_due: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  canceled: 'bg-muted text-muted-foreground border-border',
  banned: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  suspended: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  expired: 'bg-muted text-muted-foreground border-border',
}

const statusKeyMap: Record<string, string> = {
  active: 'admin.status.active',
  trialing: 'admin.status.trialing',
  paused: 'admin.status.paused',
  past_due: 'admin.status.pastDue',
  canceled: 'admin.status.canceled',
  banned: 'admin.status.banned',
  suspended: 'admin.status.suspended',
  expired: 'admin.status.expired',
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation()
  const style = statusStyles[status] ?? 'bg-muted text-muted-foreground border-border'
  const label = statusKeyMap[status] ? t(statusKeyMap[status]) : status.replace(/_/g, ' ')

  return (
    <Badge variant="outline" className={cn('gap-1.5 capitalize', style, className)}>
      {label}
    </Badge>
  )
}

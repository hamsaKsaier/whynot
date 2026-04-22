import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { FilterBar } from '../components/admin/FilterBar'
import { PaginatedTable, type Column } from '../components/admin/PaginatedTable'
import { DateRangePicker } from '../components/admin/DateRangePicker'
import { ExportMenu } from '../components/admin/ExportMenu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible'
import { getAuditLog } from '../services/api'

interface AuditEntry {
  id: string
  created_at: string
  actor_email?: string
  actor_id?: string
  action: string
  target_type?: string
  target_id?: string
  details?: Record<string, unknown>
}

const actionValues = [
  { key: 'admin.audit.actionLabels.roleChange', value: 'user.role_change' },
  { key: 'admin.audit.actionLabels.userSuspend', value: 'user.suspend' },
  { key: 'admin.audit.actionLabels.userUnsuspend', value: 'user.unsuspend' },
  { key: 'admin.audit.actionLabels.impersonate', value: 'user.impersonate' },
  { key: 'admin.audit.actionLabels.creditsGrant', value: 'credits.grant' },
  { key: 'admin.audit.actionLabels.creditsRevoke', value: 'credits.revoke' },
  { key: 'admin.audit.actionLabels.planArchive', value: 'plan.archive' },
  { key: 'admin.audit.actionLabels.planRestore', value: 'plan.restore' },
  { key: 'admin.audit.actionLabels.settingsUpdate', value: 'settings.update' },
  { key: 'admin.audit.actionLabels.billingConfig', value: 'billing_config.update' },
  { key: 'admin.audit.actionLabels.featureFlagOverride', value: 'feature_flag.override_set' },
  { key: 'admin.audit.actionLabels.announcementCreate', value: 'announcement.create' },
  { key: 'admin.audit.actionLabels.announcementUpdate', value: 'announcement.update' },
  { key: 'admin.audit.actionLabels.announcementDelete', value: 'announcement.delete' },
]

const actionStyles: Record<string, string> = {
  'user.role_change': 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300',
  'user.suspend': 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300',
  'user.unsuspend': 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300',
  'user.impersonate': 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300',
  'credits.grant': 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300',
  'credits.revoke': 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300',
  'announcement.delete': 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300',
  'billing_config.update': 'bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300',
  'feature_flag.override_set': 'bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300',
}

const fmt = (iso: string) =>
  Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

function JsonViewer({ data, label }: { data: unknown; label: string }) {
  if (data === undefined || data === null) return null
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-32">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

function DetailsCell({ details }: { details?: Record<string, unknown> }) {
  const { t } = useTranslation('admin')
  if (!details || Object.keys(details).length === 0) return <span className="text-muted-foreground">-</span>

  const hasBefore = 'before' in details
  const hasAfter = 'after' in details

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
        <ChevronDown className="h-3.5 w-3.5" />
        <span className="truncate max-w-[200px]">{JSON.stringify(details)}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {hasBefore || hasAfter ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <JsonViewer data={details.before} label={t('admin.audit.before')} />
            <JsonViewer data={details.after} label={t('admin.audit.after')} />
            {Object.keys(details).filter(k => k !== 'before' && k !== 'after').length > 0 && (
              <div className="col-span-2">
                <JsonViewer
                  data={Object.fromEntries(Object.entries(details).filter(([k]) => k !== 'before' && k !== 'after'))}
                  label={t('admin.audit.metadata')}
                />
              </div>
            )}
          </div>
        ) : (
          <pre className="mt-2 text-xs bg-muted p-2 rounded-md overflow-auto max-h-40">
            {JSON.stringify(details, null, 2)}
          </pre>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function AuditLogPage() {
  const { t } = useTranslation('admin')

  const actionOptions = actionValues.map(a => ({ label: t(a.key), value: a.value }))

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('__all__')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const cursorStack = useRef<string[]>([])
  const [pageNum, setPageNum] = useState(1)
  const limit = 30

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAuditLog({
        cursor: currentCursor,
        limit,
        action: actionFilter === '__all__' ? undefined : actionFilter,
        from: dateRange.from || undefined,
        to: dateRange.to ? `${dateRange.to}T23:59:59.999Z` : undefined,
      })
      setEntries(data.entries || [])
      setNextCursor(data.nextCursor || null)
    } finally {
      setLoading(false)
    }
  }, [currentCursor, actionFilter, dateRange])

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  const goNextPage = () => {
    if (!nextCursor) return
    cursorStack.current.push(currentCursor || '')
    setCurrentCursor(nextCursor)
    setPageNum(p => p + 1)
  }

  const goPrevPage = () => {
    if (cursorStack.current.length === 0) return
    const prev = cursorStack.current.pop()
    setCurrentCursor(prev || undefined)
    setPageNum(p => Math.max(1, p - 1))
  }

  const resetPagination = () => {
    cursorStack.current = []
    setCurrentCursor(undefined)
    setNextCursor(null)
    setPageNum(1)
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-page-${pageNum}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    const headers = [t('admin.audit.time'), t('admin.audit.actor'), t('admin.audit.action'), t('admin.audit.csvTargetType'), t('admin.audit.csvTargetId'), t('admin.audit.details')]
    const rows = entries.map(e => [
      e.created_at,
      e.actor_email || e.actor_id || t('admin.audit.system'),
      e.action,
      e.target_type || '',
      e.target_id || '',
      JSON.stringify(e.details || {}),
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-page-${pageNum}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: Column<AuditEntry>[] = [
    {
      key: 'time',
      header: t('admin.audit.time', 'Time'),
      render: (r) => <span className="text-muted-foreground whitespace-nowrap text-sm">{fmt(r.created_at)}</span>,
    },
    {
      key: 'actor',
      header: t('admin.audit.actor', 'Actor'),
      render: (r) => <span className="text-sm">{r.actor_email || r.actor_id?.slice(0, 8) || t('admin.audit.system')}</span>,
    },
    {
      key: 'action',
      header: t('admin.audit.action', 'Action'),
      render: (r) => (
        <Badge variant="outline" className={actionStyles[r.action] ?? ''}>
          {r.action}
        </Badge>
      ),
    },
    {
      key: 'target',
      header: t('admin.audit.target', 'Target'),
      hideOnMobile: true,
      render: (r) =>
        r.target_type ? (
          <code className="text-xs">{r.target_type}:{r.target_id?.slice(0, 8)}</code>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'details',
      header: t('admin.audit.details', 'Details'),
      hideOnMobile: true,
      render: (r) => <DetailsCell details={r.details} />,
    },
  ]

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={t('admin.audit.title', 'Audit Log')}
        actions={
          <div className="flex gap-2">
            <DateRangePicker
              value={dateRange}
              onChange={(r) => { setDateRange(r); resetPagination() }}
            />
            <ExportMenu onExportCSV={handleExportCSV} onExportJSON={handleExportJSON} />
          </div>
        }
      />

      <FilterBar
        filters={[
          {
            key: 'action',
            label: t('admin.audit.allActions', 'All Actions'),
            options: actionOptions,
            value: actionFilter,
            onChange: (v) => { setActionFilter(v); resetPagination() },
          },
        ]}
      />

      <PaginatedTable
        columns={columns}
        data={entries}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage={t('admin.audit.empty', 'No audit entries found')}
        skeletonRows={8}
        hasNextPage={!!nextCursor}
        hasPrevPage={cursorStack.current.length > 0}
        onNextPage={goNextPage}
        onPrevPage={goPrevPage}
        pageInfo={`${t('admin.audit.page', 'Page')} ${pageNum}`}
      />
    </div>
  )
}

export { AuditLogPage as default }

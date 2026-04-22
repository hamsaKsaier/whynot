import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { FilterBar } from '../components/admin/FilterBar'
import { PaginatedTable, type Column } from '../components/admin/PaginatedTable'
import { StatusBadge } from '../components/admin/StatusBadge'
import { ExportMenu } from '../components/admin/ExportMenu'
import { getAdminSubscriptions } from '../services/api'

interface SubRow {
  id: string
  workspace_name?: string
  workspace_id: string
  owner_name?: string
  plan_name?: string
  status: string
  credits_remaining: number
  current_period_end?: string
}

const fmt = (iso?: string) =>
  iso ? Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)) : '-'

export function SubscriptionsPage() {
  const { t } = useTranslation('superadmin')

  const statusOptions = [
    { label: t('subscriptions.statuses.active'), value: 'active' },
    { label: t('subscriptions.statuses.trialing'), value: 'trialing' },
    { label: t('subscriptions.statuses.pastDue'), value: 'past_due' },
    { label: t('subscriptions.statuses.canceled'), value: 'canceled' },
  ]

  const columns: Column<SubRow>[] = [
    { key: 'workspace', header: t('subscriptions.columns.workspace'), render: (r) => <span className="font-medium">{r.workspace_name || r.workspace_id}</span> },
    { key: 'owner', header: t('subscriptions.columns.owner'), hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{r.owner_name || '-'}</span> },
    { key: 'plan', header: t('subscriptions.columns.plan'), render: (r) => <span className="text-muted-foreground">{r.plan_name || '-'}</span> },
    { key: 'status', header: t('subscriptions.columns.status'), render: (r) => <StatusBadge status={r.status} /> },
    { key: 'credits', header: t('subscriptions.columns.credits'), className: 'text-end', hideOnMobile: true, render: (r) => <span className="font-medium">{r.credits_remaining}</span> },
    { key: 'period_end', header: t('subscriptions.columns.periodEnd'), hideOnMobile: true, render: (r) => <span className="text-muted-foreground">{fmt(r.current_period_end)}</span> },
  ]

  const [subscriptions, setSubscriptions] = useState<SubRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState('__all__')
  const [loading, setLoading] = useState(true)
  const limit = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminSubscriptions({
        offset,
        limit,
        status: statusFilter === '__all__' ? undefined : statusFilter,
      })
      setSubscriptions(data.subscriptions || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [offset, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t('subscriptions.title')} description={t('subscriptions.totalCount', { count: total })} />

      <FilterBar
        filters={[
          {
            key: 'status',
            label: t('subscriptions.allStatuses'),
            options: statusOptions,
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setOffset(0) },
          },
        ]}
      />

      <PaginatedTable
        columns={columns}
        data={subscriptions}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage={t('subscriptions.noSubscriptions')}
        hasNextPage={offset + limit < total}
        hasPrevPage={offset > 0}
        onNextPage={() => setOffset(offset + limit)}
        onPrevPage={() => setOffset(Math.max(0, offset - limit))}
        pageInfo={totalPages > 0 ? t('common:admin.common.pageOf', { current: currentPage, total: totalPages }) : undefined}
      />
    </div>
  )
}

export { SubscriptionsPage as default }

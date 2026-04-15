import { useState, useEffect, useCallback } from 'react'
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

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Trialing', value: 'trialing' },
  { label: 'Past Due', value: 'past_due' },
  { label: 'Canceled', value: 'canceled' },
]

const fmt = (iso?: string) =>
  iso ? Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)) : '-'

const columns: Column<SubRow>[] = [
  { key: 'workspace', header: 'Workspace', render: (r) => <span className="font-medium">{r.workspace_name || r.workspace_id}</span> },
  { key: 'owner', header: 'Owner', render: (r) => <span className="text-muted-foreground">{r.owner_name || '-'}</span> },
  { key: 'plan', header: 'Plan', render: (r) => <span className="text-muted-foreground">{r.plan_name || '-'}</span> },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'credits', header: 'Credits', className: 'text-end', render: (r) => <span className="font-medium">{r.credits_remaining}</span> },
  { key: 'period_end', header: 'Period End', render: (r) => <span className="text-muted-foreground">{fmt(r.current_period_end)}</span> },
]

export function SubscriptionsPage() {
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
      <AdminPageHeader title="Subscriptions" description={`${total} total`} />

      <FilterBar
        filters={[
          {
            key: 'status',
            label: 'All Statuses',
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
        emptyMessage="No subscriptions found"
        hasNextPage={offset + limit < total}
        hasPrevPage={offset > 0}
        onNextPage={() => setOffset(offset + limit)}
        onPrevPage={() => setOffset(Math.max(0, offset - limit))}
        pageInfo={totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : undefined}
      />
    </div>
  )
}

export { SubscriptionsPage as default }

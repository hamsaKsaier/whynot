import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { FilterBar } from '../components/admin/FilterBar'
import { PaginatedTable, type Column } from '../components/admin/PaginatedTable'
import { BulkActions } from '../components/admin/BulkActions'
import { StatusBadge } from '../components/admin/StatusBadge'
import { ExportMenu } from '../components/admin/ExportMenu'
import { Badge } from '../components/ui/badge'
import { getAdminOrganizations } from '../services/api'

interface OrgRow {
  id: string
  name: string
  ownerId: string
  ownerName: string
  ownerEmail: string
  planName: string | null
  status: string
  credits: number
  memberCount: number
  createdAt: string
}

export function OrganizationsPage() {
  const { t } = useTranslation()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const limit = 20

  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminOrganizations({
        offset,
        limit,
        search: search || undefined,
      })
      setOrgs(data.organizations || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [offset, search])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  const handleExportCSV = () => {
    const header = 'id,name,owner,email,plan,status,credits,created_at\n'
    const rows = orgs.map((o) =>
      `${o.id},${o.name},${o.ownerName},${o.ownerEmail},${o.planName || ''},${o.status},${o.credits},${o.createdAt}`
    )
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'organizations.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: Column<OrgRow>[] = [
    {
      key: 'name',
      header: t('admin.organizations.columns.name', 'Name'),
      render: (row) => (
        <Link to={`/organizations/${row.id}`} className="font-medium text-primary hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'owner',
      header: t('admin.organizations.columns.owner', 'Owner'),
      render: (row) => (
        <div>
          <Link to={`/users/${row.ownerId}`} className="text-sm text-primary hover:underline">
            {row.ownerName}
          </Link>
          <p className="text-xs text-muted-foreground">{row.ownerEmail}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: t('admin.organizations.columns.plan', 'Plan'),
      hideOnMobile: true,
      render: (row) => <span className="text-muted-foreground">{row.planName || '-'}</span>,
    },
    {
      key: 'status',
      header: t('admin.organizations.columns.status', 'Status'),
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'credits',
      header: t('admin.organizations.columns.credits', 'Credits'),
      className: 'text-end',
      hideOnMobile: true,
      render: (row) => <span className="font-medium">{row.credits}</span>,
    },
    {
      key: 'created_at',
      header: t('admin.organizations.columns.created', 'Created'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-muted-foreground">
          {Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(row.createdAt))}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={t('admin.organizations.title', 'Organizations')}
        description={t('admin.organizations.totalOrgs', '{{count}} total organizations', { count: total })}
        actions={<ExportMenu onExportCSV={handleExportCSV} />}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setOffset(0) }}
        searchPlaceholder={t('admin.organizations.searchPlaceholder', 'Search by name...')}
        filters={[]}
      />

      <BulkActions
        selectedCount={selectedIds.size}
        actions={[
          { label: t('admin.users.exportSelected', 'Export selected'), icon: <Download className="h-4 w-4" />, onClick: handleExportCSV },
        ]}
        onClear={() => setSelectedIds(new Set())}
      />

      <PaginatedTable
        columns={columns}
        data={orgs}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage={t('admin.organizations.noOrgsFound', 'No organizations found')}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        hasNextPage={offset + limit < total}
        hasPrevPage={offset > 0}
        onNextPage={() => setOffset(offset + limit)}
        onPrevPage={() => setOffset(Math.max(0, offset - limit))}
        pageInfo={totalPages > 0 ? t('admin.common.pageOf', 'Page {{current}} of {{total}}', { current: currentPage, total: totalPages }) : undefined}
      />
    </div>
  )
}

export { OrganizationsPage as default }

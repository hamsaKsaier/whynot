import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, Mail, MoreHorizontal, LogIn, KeyRound, Ban, UserCog, ArrowRight } from 'lucide-react'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { FilterBar } from '../components/admin/FilterBar'
import { PaginatedTable, type Column } from '../components/admin/PaginatedTable'
import { BulkActions } from '../components/admin/BulkActions'
import { StatusBadge } from '../components/admin/StatusBadge'
import { ExportMenu } from '../components/admin/ExportMenu'
import { ConfirmDialog } from '../components/admin/ConfirmDialog'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import {
  getAdminUsers,
  impersonateUser,
  resetUserPassword,
  suspendUser,
  unsuspendUser,
} from '../services/api'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  plan_name?: string
  credits: number
  status?: string
  last_seen_at?: string
  created_at: string
}

const roleBadgeStyle: Record<string, string> = {
  super_admin: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  admin: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800',
}

export function UsersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('__all__')
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banTarget, setBanTarget] = useState<UserRow | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const limit = 20

  const roleOptions = [
    { label: t('admin.users.roles.user', 'User'), value: 'user' },
    { label: t('admin.users.roles.admin', 'Admin'), value: 'admin' },
    { label: t('admin.users.roles.superAdmin', 'Super Admin'), value: 'super_admin' },
  ]

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminUsers({
        offset,
        limit,
        search: search || undefined,
        role: roleFilter === '__all__' ? undefined : roleFilter,
      })
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [offset, search, roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  const handleExportCSV = () => {
    const header = 'id,name,email,role,plan,credits,joined\n'
    const rows = users.map((u) => `${u.id},${u.name},${u.email},${u.role},${u.plan_name || ''},${u.credits},${u.created_at}`)
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'users.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImpersonate = async (user: UserRow) => {
    const data = await impersonateUser(user.id)
    if (data?.token) {
      window.open(`/?impersonate_token=${data.token}`, '_blank')
    }
  }

  const handleResetPassword = async (user: UserRow) => {
    await resetUserPassword(user.id)
    await fetchUsers()
  }

  const handleBan = async () => {
    if (!banTarget) return
    setActionLoading(true)
    try {
      await suspendUser(banTarget.id)
      setBanDialogOpen(false)
      setBanTarget(null)
      await fetchUsers()
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnban = async (user: UserRow) => {
    await unsuspendUser(user.id)
    await fetchUsers()
  }

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: t('admin.users.columns.name', 'Name'),
      render: (row) => (
        <Link to={`/users/${row.id}`} className="font-medium text-primary hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'email',
      header: t('admin.users.columns.email', 'Email'),
      render: (row) => <span className="text-muted-foreground">{row.email}</span>,
    },
    {
      key: 'role',
      header: t('admin.users.columns.role', 'Role'),
      render: (row) => (
        <Badge variant="outline" className={`capitalize ${roleBadgeStyle[row.role] ?? ''}`}>
          {row.role.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'plan',
      header: t('admin.users.columns.plan', 'Plan'),
      hideOnMobile: true,
      render: (row) => <span className="text-muted-foreground">{row.plan_name || '-'}</span>,
    },
    {
      key: 'credits',
      header: t('admin.users.columns.credits', 'Credits'),
      className: 'text-end',
      hideOnMobile: true,
      render: (row) => <span className="font-medium">{row.credits}</span>,
    },
    {
      key: 'created_at',
      header: t('admin.users.columns.joined', 'Joined'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-muted-foreground">
          {Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(row.created_at))}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/users/${row.id}`)}>
              <ArrowRight className="h-4 w-4 me-2 rtl:scale-x-[-1]" />
              {t('admin.users.viewDetail', 'View Details')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleImpersonate(row)}>
              <LogIn className="h-4 w-4 me-2 rtl:scale-x-[-1]" />
              {t('admin.userDetail.impersonate', 'Impersonate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleResetPassword(row)}>
              <KeyRound className="h-4 w-4 me-2" />
              {t('admin.userDetail.resetPassword', 'Reset Password')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.status === 'suspended' ? (
              <DropdownMenuItem onClick={() => handleUnban(row)}>
                <UserCog className="h-4 w-4 me-2" />
                {t('admin.userDetail.unban', 'Unban')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => { setBanTarget(row); setBanDialogOpen(true) }}
              >
                <Ban className="h-4 w-4 me-2" />
                {t('admin.userDetail.ban', 'Ban')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={t('admin.users.title', 'Users')}
        description={t('admin.users.totalUsers', '{{count}} total users', { count: total })}
        actions={<ExportMenu onExportCSV={handleExportCSV} />}
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setOffset(0) }}
        searchPlaceholder={t('admin.users.searchPlaceholder', 'Search by name or email...')}
        filters={[
          {
            key: 'role',
            label: t('admin.users.allRoles', 'All Roles'),
            options: roleOptions,
            value: roleFilter,
            onChange: (v) => { setRoleFilter(v); setOffset(0) },
          },
        ]}
      />

      <BulkActions
        selectedCount={selectedIds.size}
        actions={[
          { label: t('admin.users.exportSelected', 'Export selected'), icon: <Download className="h-4 w-4" />, onClick: handleExportCSV },
          { label: t('admin.users.emailSelected', 'Email selected'), icon: <Mail className="h-4 w-4" />, onClick: () => {} },
        ]}
        onClear={() => setSelectedIds(new Set())}
      />

      <PaginatedTable
        columns={columns}
        data={users}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage={t('admin.users.noUsersFound', 'No users found')}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        hasNextPage={offset + limit < total}
        hasPrevPage={offset > 0}
        onNextPage={() => setOffset(offset + limit)}
        onPrevPage={() => setOffset(Math.max(0, offset - limit))}
        pageInfo={totalPages > 0 ? t('admin.common.pageOf', 'Page {{current}} of {{total}}', { current: currentPage, total: totalPages }) : undefined}
      />

      <ConfirmDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        title={t('admin.userDetail.banTitle', 'Ban User')}
        description={t('admin.userDetail.banDescription', 'Are you sure you want to ban {{name}}? They will lose access to their account immediately.', { name: banTarget?.name })}
        typeToConfirm={banTarget?.email}
        confirmText={t('admin.userDetail.banConfirm', 'Ban User')}
        variant="destructive"
        loading={actionLoading}
        onConfirm={handleBan}
      />
    </div>
  )
}

export { UsersPage as default }

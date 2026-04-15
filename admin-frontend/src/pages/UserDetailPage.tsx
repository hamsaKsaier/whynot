import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, Ban, LogIn, Loader2, KeyRound, UserCog, Flag, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Switch } from '../components/ui/switch'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { ConfirmDialog } from '../components/admin/ConfirmDialog'
import { StatusBadge } from '../components/admin/StatusBadge'
import {
  getAdminUser,
  updateUserRole,
  grantCredits,
  revokeCredits,
  suspendUser,
  unsuspendUser,
  impersonateUser,
  resetUserPassword,
  forceUserPlan,
  getAdminPlans,
  getAuditLog,
  getOrgFeatureFlags,
  setOrgFlagOverride,
  clearOrgFlagOverride,
} from '../services/api'

export function UserDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditDescription, setCreditDescription] = useState('')
  const [tab, setTab] = useState('overview')
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [auditEntries, setAuditEntries] = useState<any[]>([])
  const [flagOverrides, setFlagOverrides] = useState<any[]>([])
  const [primaryWsId, setPrimaryWsId] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [userData, plansData] = await Promise.all([
        getAdminUser(id),
        getAdminPlans(),
      ])
      setUser(userData.user)
      setWorkspaces(userData.workspaces || [])
      setPlans(plansData.plans || [])

      const ws = userData.workspaces?.[0]
      if (ws) {
        setPrimaryWsId(ws.id)
        try {
          const flags = await getOrgFeatureFlags(ws.id)
          const allFlags = flags.flags || []
          setFlagOverrides(allFlags.map((f: any) => ({
            key: f.key,
            enabled: f.override_enabled ?? f.default_enabled,
            hasOverride: f.override_enabled !== null && f.override_enabled !== undefined,
          })))
        } catch { setFlagOverrides([]) }
      }

      try {
        const audit = await getAuditLog({ target_id: id, limit: 20 })
        setAuditEntries(audit.entries || [])
      } catch { setAuditEntries([]) }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const handleRoleChange = async (newRole: string) => {
    if (!id) return
    await updateUserRole(id, newRole)
    await fetchUser()
  }

  const handleGrant = async (wsId: string) => {
    const amount = parseInt(creditAmount)
    if (!amount || amount <= 0) return
    await grantCredits(wsId, amount, creditDescription || 'Admin grant')
    setCreditAmount('')
    setCreditDescription('')
    await fetchUser()
  }

  const handleRevoke = async (wsId: string) => {
    const amount = parseInt(creditAmount)
    if (!amount || amount <= 0) return
    await revokeCredits(wsId, amount, creditDescription || 'Admin revoke')
    setCreditAmount('')
    setCreditDescription('')
    await fetchUser()
  }

  const handleBan = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await suspendUser(id)
      setBanDialogOpen(false)
      await fetchUser()
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnban = async () => {
    if (!id) return
    await unsuspendUser(id)
    await fetchUser()
  }

  const handleImpersonate = async () => {
    if (!id) return
    const data = await impersonateUser(id)
    if (data?.token) {
      window.open(`/?impersonate_token=${data.token}`, '_blank')
    }
  }

  const handleResetPassword = async () => {
    if (!id) return
    await resetUserPassword(id)
  }

  const handleForcePlan = async () => {
    if (!id || !selectedPlanId) return
    setActionLoading(true)
    try {
      await forceUserPlan(id, selectedPlanId)
      await fetchUser()
    } finally {
      setActionLoading(false)
    }
  }

  const handleFlagToggle = async (key: string, currentlyEnabled: boolean) => {
    if (!primaryWsId) return
    if (currentlyEnabled) {
      await clearOrgFlagOverride(primaryWsId, key)
    } else {
      await setOrgFlagOverride(primaryWsId, key, true)
    }
    await fetchUser()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('admin.userDetail.notFound', 'User not found.')}
        <Button variant="link" onClick={() => navigate('/users')}>
          {t('admin.users.title', 'Users')}
        </Button>
      </div>
    )
  }

  const fmt = (iso: string) =>
    Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={user.name}
        description={user.email}
        breadcrumbs={[
          { label: t('admin.users.title', 'Users'), to: '/users' },
          { label: user.name },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleImpersonate}>
              <LogIn className="h-4 w-4 me-1.5 rtl:scale-x-[-1]" />
              {t('admin.userDetail.impersonate', 'Impersonate')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleResetPassword}>
              <KeyRound className="h-4 w-4 me-1.5" />
              {t('admin.userDetail.resetPassword', 'Reset Password')}
            </Button>
            {user.is_suspended ? (
              <Button variant="outline" size="sm" onClick={handleUnban}>
                {t('admin.userDetail.unban', 'Unban')}
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => setBanDialogOpen(true)}>
                <Ban className="h-4 w-4 me-1.5" />
                {t('admin.userDetail.ban', 'Ban')}
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('admin.userDetail.tabs.overview', 'Overview')}</TabsTrigger>
          <TabsTrigger value="subscription">{t('admin.userDetail.tabs.subscription', 'Subscription')}</TabsTrigger>
          <TabsTrigger value="flags">
            <Flag className="h-3.5 w-3.5 me-1.5" />
            {t('admin.userDetail.tabs.flags', 'Flags')}
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="h-3.5 w-3.5 me-1.5" />
            {t('admin.userDetail.tabs.audit', 'Audit')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {t('admin.userDetail.id', 'ID')}: <code className="text-xs">{user.id}</code>
                  </p>
                  <div className="flex gap-2 mt-2">
                    {user.github_id && <Badge variant="outline">GitHub</Badge>}
                    {user.google_id && <Badge variant="outline">Google</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('admin.userDetail.joined', 'Joined')} {fmt(user.created_at)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('admin.userDetail.role', 'Role')}</Label>
                  <Select value={user.role} onValueChange={handleRoleChange}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t('admin.users.roles.user', 'User')}</SelectItem>
                      <SelectItem value="admin">{t('admin.users.roles.admin', 'Admin')}</SelectItem>
                      <SelectItem value="super_admin">{t('admin.users.roles.superAdmin', 'Super Admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {workspaces.map((ws: any) => (
            <Card key={ws.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <Link to={`/organizations/${ws.id}`} className="hover:underline">{ws.name}</Link>
                  <div className="flex gap-2">
                    {ws.subscription?.status && <StatusBadge status={ws.subscription.status} />}
                    <Badge variant="outline">{ws.plan_name || t('admin.userDetail.noPlan', 'No plan')}</Badge>
                    <Badge variant="secondary">{ws.credits} {t('admin.userDetail.credits', 'credits')}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 pt-2 border-t">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('admin.userDetail.amount', 'Amount')}</Label>
                    <Input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="100"
                      className="w-24"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{t('admin.userDetail.description', 'Description')}</Label>
                    <Input
                      value={creditDescription}
                      onChange={(e) => setCreditDescription(e.target.value)}
                      placeholder={t('admin.userDetail.reason', 'Reason...')}
                    />
                  </div>
                  <Button size="sm" onClick={() => handleGrant(ws.id)}>
                    <Plus className="h-3.5 w-3.5 me-1" />
                    {t('admin.userDetail.grantCredits', 'Grant')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleRevoke(ws.id)}>
                    <Minus className="h-3.5 w-3.5 me-1" />
                    {t('admin.userDetail.revokeCredits', 'Revoke')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="subscription" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.userDetail.forcePlan', 'Force Plan')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">{t('admin.userDetail.selectPlan', 'Select Plan')}</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.userDetail.choosePlan', 'Choose a plan...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={handleForcePlan}
                  disabled={!selectedPlanId || actionLoading}
                >
                  {actionLoading && <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />}
                  {t('admin.userDetail.applyPlan', 'Apply Plan')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {workspaces.map((ws: any) => (
            <Card key={ws.id}>
              <CardHeader>
                <CardTitle className="text-base">{ws.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('admin.orgDetail.plan', 'Plan')}</p>
                    <p className="text-sm font-medium">{ws.plan_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('admin.orgDetail.status', 'Status')}</p>
                    {ws.subscription?.status ? <StatusBadge status={ws.subscription.status} /> : <span className="text-sm">-</span>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('admin.orgDetail.periodEnd', 'Period End')}</p>
                    <p className="text-sm">{ws.subscription?.current_period_end ? fmt(ws.subscription.current_period_end) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('admin.orgDetail.credits', 'Credits')}</p>
                    <p className="text-sm font-medium">{ws.credits}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="flags" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.userDetail.flagOverrides', 'Feature Flag Overrides')}</CardTitle>
            </CardHeader>
            <CardContent>
              {flagOverrides.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t('admin.userDetail.noFlags', 'No flag overrides for this user\'s workspace.')}
                </p>
              ) : (
                <div className="space-y-3">
                  {flagOverrides.map((flag: any) => (
                    <div key={flag.key} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <p className="font-medium text-sm">{flag.key}</p>
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={() => handleFlagToggle(flag.key, flag.enabled)}
                        className="data-[state=checked]:bg-green-600"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t('admin.auditLog.columns.time', 'Time')}</TableHead>
                    <TableHead className="text-start">{t('admin.auditLog.columns.actor', 'Actor')}</TableHead>
                    <TableHead className="text-start">{t('admin.auditLog.columns.action', 'Action')}</TableHead>
                    <TableHead className="text-start">{t('admin.auditLog.columns.details', 'Details')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('admin.auditLog.noEntries', 'No audit entries found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditEntries.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground text-sm">{fmt(entry.created_at)}</TableCell>
                        <TableCell className="text-sm">{entry.actor_email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {entry.details ? JSON.stringify(entry.details) : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        title={t('admin.userDetail.banTitle', 'Ban User')}
        description={t('admin.userDetail.banDescription', 'Are you sure you want to ban {{name}}? They will lose access to their account immediately.', { name: user.name })}
        typeToConfirm={user.email}
        confirmText={t('admin.userDetail.banConfirm', 'Ban User')}
        variant="destructive"
        loading={actionLoading}
        onConfirm={handleBan}
      />
    </div>
  )
}

export { UserDetailPage as default }

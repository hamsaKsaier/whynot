import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Save, Users, CreditCard, Flag, FileText } from 'lucide-react'
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
import { StatusBadge } from '../components/admin/StatusBadge'
import {
  getAdminOrganization,
  updateOrganization,
  getAdminPlans,
  setOrgFlagOverrideViaOrg,
} from '../services/api'

interface OrgDetail {
  id: string
  name: string
  ownerId: string
  ownerName: string | null
  ownerEmail: string | null
  createdAt: string
}

interface OrgSubscription {
  id: string
  planId: string
  planName: string | null
  status: string
  currentPeriodEnd: string | null
  trialEnd: string | null
  cancelAtPeriodEnd: boolean
}

interface OrgMember {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

interface FlagOverride {
  key: string
  enabled: boolean
}

interface AuditEntry {
  id: string
  actor_email: string | null
  action: string
  details: Record<string, any>
  created_at: string
}

export function OrganizationDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [subscription, setSubscription] = useState<OrgSubscription | null>(null)
  const [credits, setCredits] = useState(0)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [flagOverrides, setFlagOverrides] = useState<FlagOverride[]>([])
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const initialTab = searchParams.get('tab') || 'overview'
  const [tab, setTab] = useState(initialTab)
  const [plans, setPlans] = useState<any[]>([])

  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editPlanId, setEditPlanId] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchOrg = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [data, plansData] = await Promise.all([
        getAdminOrganization(id),
        getAdminPlans(),
      ])
      setOrg(data.organization)
      setSubscription(data.subscription)
      setCredits(data.credits || 0)
      setMembers(data.members || [])
      setFlagOverrides(data.flagOverrides || [])
      setAuditLog(data.auditLog || [])
      setPlans(plansData.plans || [])
      setEditName(data.organization.name)
      setEditStatus(data.subscription?.status || 'none')
      setEditPlanId(data.subscription?.planId || '')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchOrg()
  }, [fetchOrg])

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      const updates: Record<string, string> = {}
      if (editName !== org?.name) updates.name = editName
      if (editStatus !== (subscription?.status || 'none')) updates.status = editStatus
      if (editPlanId && editPlanId !== (subscription?.planId || '')) updates.planId = editPlanId
      if (Object.keys(updates).length > 0) {
        await updateOrganization(id, updates)
        await fetchOrg()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleTabChange = useCallback((newTab: string) => {
    setTab(newTab)
    setSearchParams({ tab: newTab }, { replace: true })
  }, [setSearchParams])

  const handleFlagToggle = async (key: string, enabled: boolean) => {
    if (!id) return
    await setOrgFlagOverrideViaOrg(id, key, enabled)
    await fetchOrg()
  }

  const fmt = (iso: string) =>
    Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('admin.organizations.notFound', 'Organization not found.')}
        <Button variant="link" onClick={() => navigate('/organizations')}>
          {t('admin.organizations.backToOrgs', 'Back to Organizations')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={org.name}
        description={org.ownerEmail || org.ownerId}
        breadcrumbs={[
          { label: t('admin.organizations.title', 'Organizations'), to: '/organizations' },
          { label: org.name },
        ]}
        actions={
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 me-1.5 animate-spin" /> : <Save className="h-4 w-4 me-1.5" />}
            {t('admin.common.save', 'Save')}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">{t('admin.orgDetail.tabs.overview', 'Overview')}</TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-3.5 w-3.5 me-1.5" />
            {t('admin.orgDetail.tabs.members', 'Members')}
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="h-3.5 w-3.5 me-1.5" />
            {t('admin.orgDetail.tabs.subscription', 'Subscription')}
          </TabsTrigger>
          <TabsTrigger value="flags">
            <Flag className="h-3.5 w-3.5 me-1.5" />
            {t('admin.orgDetail.tabs.flags', 'Flags')}
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="h-3.5 w-3.5 me-1.5" />
            {t('admin.orgDetail.tabs.audit', 'Audit')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.orgDetail.details', 'Organization Details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('admin.orgDetail.name', 'Name')}</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('admin.orgDetail.id', 'ID')}</Label>
                  <code className="block text-xs p-2 bg-muted rounded-md">{org.id}</code>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('admin.orgDetail.owner', 'Owner')}</Label>
                  <div>
                    <Link to={`/users/${org.ownerId}`} className="text-sm text-primary hover:underline">
                      {org.ownerName || org.ownerId}
                    </Link>
                    {org.ownerEmail && <p className="text-xs text-muted-foreground">{org.ownerEmail}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('admin.orgDetail.created', 'Created')}</Label>
                  <p className="text-sm text-muted-foreground">{fmt(org.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-semibold">{credits}</p>
                <p className="text-xs text-muted-foreground">{t('admin.orgDetail.credits', 'Credits')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-semibold">{members.length}</p>
                <p className="text-xs text-muted-foreground">{t('admin.orgDetail.tabs.members', 'Members')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                {subscription ? <StatusBadge status={subscription.status} /> : <Badge variant="outline">None</Badge>}
                <p className="text-xs text-muted-foreground mt-1">{t('admin.orgDetail.tabs.subscription', 'Subscription')}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t('admin.users.columns.name', 'Name')}</TableHead>
                    <TableHead className="text-start">{t('admin.users.columns.email', 'Email')}</TableHead>
                    <TableHead className="text-start">{t('admin.users.columns.role', 'Role')}</TableHead>
                    <TableHead className="text-start">{t('admin.users.columns.joined', 'Joined')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('admin.organizations.noMembers', 'No members found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Link to={`/users/${m.id}`} className="font-medium text-primary hover:underline">{m.name}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{m.role.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(m.created_at))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.orgDetail.subscriptionDetails', 'Subscription Details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('admin.orgDetail.plan', 'Plan')}</Label>
                  <Select value={editPlanId} onValueChange={setEditPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.orgDetail.selectPlan', 'Select plan...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('admin.orgDetail.status', 'Status')}</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trialing">Trialing</SelectItem>
                      <SelectItem value="past_due">Past Due</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {subscription && (
                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('admin.orgDetail.periodEnd', 'Period End')}</p>
                    <p className="text-sm">{subscription.currentPeriodEnd ? fmt(subscription.currentPeriodEnd) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('admin.orgDetail.trialEnd', 'Trial End')}</p>
                    <p className="text-sm">{subscription.trialEnd ? fmt(subscription.trialEnd) : '-'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.orgDetail.flagOverrides', 'Feature Flag Overrides')}</CardTitle>
            </CardHeader>
            <CardContent>
              {flagOverrides.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t('admin.orgDetail.noFlagOverrides', 'No flag overrides set for this organization.')}
                </p>
              ) : (
                <div className="space-y-3">
                  {flagOverrides.map((flag) => (
                    <div key={flag.key} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{flag.key}</p>
                      </div>
                      <Switch
                        checked={flag.enabled}
                        onCheckedChange={(checked) => handleFlagToggle(flag.key, checked)}
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
            <CardContent className="p-0 overflow-x-auto">
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
                  {auditLog.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('admin.auditLog.noEntries', 'No audit entries found')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLog.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {fmt(entry.created_at)}
                        </TableCell>
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
    </div>
  )
}

export { OrganizationDetailPage as default }

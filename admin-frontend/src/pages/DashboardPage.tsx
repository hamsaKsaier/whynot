import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Users, DollarSign, CreditCard, TrendingUp, UserPlus, Package, BarChart3, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { formatCents } from '../lib/money'
import { getAdminOverviewStats, getAdminUsers } from '../services/api'

export function DashboardPage() {
  const { t } = useTranslation('common')
  const [stats, setStats] = useState<any>(null)
  const [recentUsers, setRecentUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getAdminOverviewStats().catch(() => ({ stats: {} })),
      getAdminUsers({ limit: 5 }).catch(() => ({ users: [] })),
    ]).then(([statsData, usersData]) => {
      setStats(statsData.stats)
      setRecentUsers(usersData.users || [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-10 sm:hidden" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const mrrCents = stats?.mrr_cents ?? 0
  const kpis = [
    { label: t('admin.dashboard.totalUsers'), value: String(stats?.total_users ?? 0), icon: Users, color: 'text-blue-600 dark:text-blue-400' },
    { label: t('admin.dashboard.mrr'), value: formatCents(mrrCents, { whole: true }), icon: DollarSign, color: 'text-green-600 dark:text-green-400' },
    { label: t('admin.dashboard.activePlans'), value: String(stats?.subscriptions_by_plan?.length ?? 0), icon: CreditCard, color: 'text-sky-600 dark:text-sky-400' },
    { label: t('admin.dashboard.arr'), value: formatCents(mrrCents * 12, { whole: true }), icon: TrendingUp, color: 'text-orange-600 dark:text-orange-400' },
  ]

  const quickActions = [
    { label: t('admin.dashboard.quickActions.users'), icon: UserPlus, to: '/users' },
    { label: t('admin.dashboard.quickActions.plans'), icon: Package, to: '/plans' },
    { label: t('admin.dashboard.quickActions.analytics'), icon: BarChart3, to: '/analytics' },
    { label: t('admin.dashboard.quickActions.settings'), icon: Settings, to: '/settings' },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader title={t('admin.dashboard.title')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{kpi.label}</p>
                    <p className="text-xl sm:text-2xl font-semibold">{kpi.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick actions - sticky on mobile */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent" data-testid="quick-actions">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.to}
                variant="outline"
                size="sm"
                className="flex-shrink-0 gap-1.5"
                asChild
              >
                <Link to={action.to}>
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{action.label}</span>
                </Link>
              </Button>
            )
          })}
        </div>
      </div>

      <Tabs defaultValue="signups">
        <TabsList>
          <TabsTrigger value="signups">{t('admin.dashboard.recentSignups')}</TabsTrigger>
          <TabsTrigger value="plans">{t('admin.dashboard.subscriptionsByPlan')}</TabsTrigger>
        </TabsList>

        <TabsContent value="signups" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.dashboard.recentUsers')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-12 px-4">
                  {t('admin.dashboard.noUsers')}
                </p>
              ) : (
                <>
                  {/* Desktop: table view */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('admin.dashboard.columns.name')}</TableHead>
                          <TableHead>{t('admin.dashboard.columns.email')}</TableHead>
                          <TableHead>{t('admin.dashboard.columns.plan')}</TableHead>
                          <TableHead className="text-end">{t('admin.dashboard.columns.credits')}</TableHead>
                          <TableHead>{t('admin.dashboard.columns.joined')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentUsers.map((u: any) => (
                          <TableRow key={u.id}>
                            <TableCell>
                              <Link to={`/users/${u.id}`} className="font-medium text-primary hover:underline">
                                {u.name}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{u.email}</TableCell>
                            <TableCell className="text-muted-foreground">{u.plan_name || '-'}</TableCell>
                            <TableCell className="text-end font-medium">{u.credits}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(u.created_at))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile: card view */}
                  <div className="md:hidden divide-y" data-testid="mobile-user-cards">
                    {recentUsers.map((u: any) => (
                      <div key={u.id} className="p-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Link to={`/users/${u.id}`} className="font-medium text-primary hover:underline truncate">
                            {u.name}
                          </Link>
                          <span className="text-sm font-medium flex-shrink-0">{u.credits} {t('admin.dashboard.creditsLabel')}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{u.plan_name || '-'}</span>
                          <span>{Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(u.created_at))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('admin.dashboard.subscriptionsByPlan')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.subscriptions_by_plan && stats.subscriptions_by_plan.length > 0 ? (
                <div className="space-y-3">
                  {stats.subscriptions_by_plan.map((item: any) => (
                    <div key={item.plan_id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm">{item.plan_id}</span>
                      <span className="text-sm font-medium">{t('admin.dashboard.subscribers', { count: item.count })}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{t('admin.dashboard.noSubscriptionData')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { DashboardPage as default }

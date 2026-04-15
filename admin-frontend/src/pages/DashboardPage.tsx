import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, DollarSign, CreditCard, TrendingUp, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton } from '../components/ui/skeleton'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { StatusBadge } from '../components/admin/StatusBadge'
import { formatCents } from '../lib/money'
import { getAdminOverviewStats, getAdminUsers } from '../services/api'

export function DashboardPage() {
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
        <Skeleton className="h-64" />
      </div>
    )
  }

  const mrrCents = stats?.mrr_cents ?? 0
  const kpis = [
    { label: 'Total Users', value: String(stats?.total_users ?? 0), icon: Users, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'MRR', value: formatCents(mrrCents, { whole: true }), icon: DollarSign, color: 'text-green-600 dark:text-green-400' },
    { label: 'Active Plans', value: String(stats?.subscriptions_by_plan?.length ?? 0), icon: CreditCard, color: 'text-sky-600 dark:text-sky-400' },
    { label: 'ARR', value: formatCents(mrrCents * 12, { whole: true }), icon: TrendingUp, color: 'text-orange-600 dark:text-orange-400' },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Dashboard" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${kpi.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-semibold">{kpi.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="signups">
        <TabsList>
          <TabsTrigger value="signups">Recent Signups</TabsTrigger>
          <TabsTrigger value="plans">Subscriptions by Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="signups" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Users</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-end">Credits</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                        No users yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentUsers.map((u: any) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscriptions by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.subscriptions_by_plan && stats.subscriptions_by_plan.length > 0 ? (
                <div className="space-y-3">
                  {stats.subscriptions_by_plan.map((item: any) => (
                    <div key={item.plan_id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm">{item.plan_id}</span>
                      <span className="text-sm font-medium">{item.count} subscribers</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No subscription data</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { DashboardPage as default }

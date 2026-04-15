import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { DateRangePicker } from '../components/admin/DateRangePicker'
import { ExportMenu } from '../components/admin/ExportMenu'
import { formatCents } from '../lib/money'
import {
  getAnalyticsOverview,
  getAnalyticsSignups,
  getAnalyticsRevenue,
  getAnalyticsUsage,
  getAnalyticsChurn,
} from '../services/api'

interface OverviewData {
  total_users: number
  active_subscriptions: number
  mrr_cents: number
  arr_cents: number
  dau: number
  mau: number
  churn_30d: number
}

export function AnalyticsPage() {
  const { t } = useTranslation('admin')
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [signups, setSignups] = useState<any[]>([])
  const [revenue, setRevenue] = useState<any[]>([])
  const [usage, setUsage] = useState<any[]>([])
  const [churn, setChurn] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  useEffect(() => {
    Promise.all([
      getAnalyticsOverview(),
      getAnalyticsSignups(30),
      getAnalyticsRevenue(),
      getAnalyticsUsage(30),
      getAnalyticsChurn(90),
    ])
      .then(([ov, su, rev, us, ch]) => {
        setOverview(ov.overview)
        setSignups(su.signups || [])
        setRevenue(rev.revenue || [])
        setUsage(us.usage || [])
        setChurn(ch.churn || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleExportJSON = () => {
    const data = { overview, signups, revenue, usage, churn }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'analytics-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const churnRate = overview && overview.active_subscriptions > 0
    ? ((overview.churn_30d / overview.active_subscriptions) * 100).toFixed(1)
    : '0.0'

  const kpis = [
    { label: t('admin.analytics.dau', 'DAU'), value: String(overview?.dau || 0) },
    { label: t('admin.analytics.mau', 'MAU'), value: String(overview?.mau || 0) },
    { label: t('admin.analytics.totalUsers', 'Total Users'), value: String(overview?.total_users || 0) },
    { label: t('admin.analytics.activeSubscriptions', 'Active Subscriptions'), value: String(overview?.active_subscriptions || 0) },
    { label: t('admin.analytics.mrr', 'MRR'), value: formatCents(overview?.mrr_cents || 0) },
    { label: t('admin.analytics.arr', 'ARR'), value: formatCents(overview?.arr_cents || 0) },
    { label: t('admin.analytics.churnRate', 'Churn (30d)'), value: `${churnRate}%` },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.analytics.title', 'Analytics')}
        actions={
          <div className="flex gap-2">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <ExportMenu onExportJSON={handleExportJSON} />
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-semibold mt-1">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.analytics.signups', 'Signups (Last 30 days)')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={signups}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.analytics.revenueByPlan', 'Revenue by Plan')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="plan_name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => formatCents(v, { whole: true })} />
                <Tooltip formatter={(val: number) => formatCents(val)} />
                <Bar dataKey="mrr_cents" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.analytics.creditUsage', 'Credit Usage (Last 30 days)')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={usage}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <Tooltip />
                <Area type="monotone" dataKey="credits_used" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.analytics.cancellations', 'Cancellations (Last 90 days)')}</CardTitle>
        </CardHeader>
        <CardContent>
          {churn.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('admin.analytics.noCancellations', 'No cancellations in this period')}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={churn}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                <Tooltip />
                <Bar dataKey="cancellations" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { AnalyticsPage as default }

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { FilterBar } from '../components/admin/FilterBar'
import { PaginatedTable, type Column } from '../components/admin/PaginatedTable'
import { DateRangePicker } from '../components/admin/DateRangePicker'
import { ExportMenu } from '../components/admin/ExportMenu'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { getUsageEvents, getUsageSummary } from '../services/api'

interface UsageEvent {
  id: string
  workspace_id: string
  user_id?: string
  event_type: string
  credits_consumed: number
  metadata?: Record<string, unknown>
  created_at: string
}

interface OrgUsage {
  workspaceId: string
  eventCount: number
  totalCredits: number
}

interface TypeUsage {
  eventType: string
  eventCount: number
  totalCredits: number
}

interface DailyUsage {
  date: string
  eventCount: number
  totalCredits: number
}

const fmt = (iso: string) =>
  Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

export function UsageTrackingPage() {
  const { t } = useTranslation('admin')
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'overview'
  const [tab, setTabState] = useState(initialTab)
  const setTab = useCallback((newTab: string) => {
    setTabState(newTab)
    setSearchParams({ tab: newTab }, { replace: true })
  }, [setSearchParams])

  const [byOrg, setByOrg] = useState<OrgUsage[]>([])
  const [byType, setByType] = useState<TypeUsage[]>([])
  const [daily, setDaily] = useState<DailyUsage[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [events, setEvents] = useState<UsageEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [orgFilter, setOrgFilter] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const cursorStack = useRef<string[]>([])
  const [pageNum, setPageNum] = useState(1)
  const limit = 30

  useEffect(() => {
    setSummaryLoading(true)
    getUsageSummary()
      .then((data) => {
        setByOrg(data.byOrg || [])
        setByType(data.byType || [])
        setDaily(data.daily || [])
      })
      .finally(() => setSummaryLoading(false))
  }, [])

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true)
    try {
      const data = await getUsageEvents({
        cursor: currentCursor,
        limit,
        org_id: orgFilter || undefined,
        from: dateRange.from || undefined,
        to: dateRange.to ? `${dateRange.to}T23:59:59.999Z` : undefined,
      })
      setEvents(data.entries || [])
      setNextCursor(data.nextCursor || null)
    } finally {
      setEventsLoading(false)
    }
  }, [currentCursor, orgFilter, dateRange])

  useEffect(() => {
    if (tab === 'events') fetchEvents()
  }, [tab, fetchEvents])

  const resetPagination = () => {
    cursorStack.current = []
    setCurrentCursor(undefined)
    setNextCursor(null)
    setPageNum(1)
  }

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

  const handleExportCSV = () => {
    const rows = tab === 'events'
      ? [
          ['Time', 'Workspace', 'User', 'Event Type', 'Credits', 'Metadata'],
          ...events.map(e => [e.created_at, e.workspace_id, e.user_id || '', e.event_type, String(e.credits_consumed), JSON.stringify(e.metadata || {})])
        ]
      : [
          ['Workspace ID', 'Event Count', 'Total Credits'],
          ...byOrg.map(o => [o.workspaceId, String(o.eventCount), String(o.totalCredits)])
        ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usage-${tab}-export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportJSON = () => {
    const data = tab === 'events' ? events : { byOrg, byType, daily }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usage-${tab}-export.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalCredits = byOrg.reduce((sum, o) => sum + o.totalCredits, 0)
  const totalEvents = byOrg.reduce((sum, o) => sum + o.eventCount, 0)
  const isEmpty = byOrg.length === 0 && byType.length === 0 && daily.length === 0

  const eventColumns: Column<UsageEvent>[] = [
    {
      key: 'time',
      header: t('admin.usage.time', 'Time'),
      render: (r) => <span className="text-sm text-muted-foreground whitespace-nowrap">{fmt(r.created_at)}</span>,
    },
    {
      key: 'workspace',
      header: t('admin.usage.workspace', 'Workspace'),
      hideOnMobile: true,
      render: (r) => <code className="text-xs">{r.workspace_id?.slice(0, 8)}</code>,
    },
    {
      key: 'event_type',
      header: t('admin.usage.eventType', 'Event Type'),
      render: (r) => <span className="text-sm">{r.event_type}</span>,
    },
    {
      key: 'credits',
      header: t('admin.usage.credits', 'Credits'),
      className: 'text-end',
      render: (r) => <span className="text-sm font-medium">{r.credits_consumed}</span>,
    },
  ]

  const orgColumns: Column<OrgUsage>[] = [
    {
      key: 'workspace',
      header: t('admin.usage.workspace', 'Workspace'),
      render: (r) => <code className="text-xs">{r.workspaceId?.slice(0, 12)}</code>,
    },
    {
      key: 'events',
      header: t('admin.usage.events', 'Events'),
      className: 'text-end',
      render: (r) => <span className="text-sm">{r.eventCount.toLocaleString()}</span>,
    },
    {
      key: 'credits',
      header: t('admin.usage.totalCredits', 'Total Credits'),
      className: 'text-end',
      render: (r) => <span className="text-sm font-medium">{r.totalCredits.toLocaleString()}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.usage.title', 'Usage Tracking')}
        description={isEmpty && !summaryLoading ? t('admin.usage.noData', 'No usage data available yet') : undefined}
        actions={
          <ExportMenu onExportCSV={handleExportCSV} onExportJSON={handleExportJSON} />
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('admin.usage.overviewTab', 'Overview')}</TabsTrigger>
          <TabsTrigger value="orgs">{t('admin.usage.orgsTab', 'By Organization')}</TabsTrigger>
          <TabsTrigger value="events">{t('admin.usage.eventsTab', 'Events')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {summaryLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : isEmpty ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {t('admin.usage.emptyState', 'Usage tracking data will appear here once usage events start flowing. This page will automatically populate when usage_events are available.')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('admin.usage.totalEvents', 'Total Events')}</p>
                    <p className="text-2xl font-semibold mt-1">{totalEvents.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('admin.usage.totalCreditsUsed', 'Total Credits Used')}</p>
                    <p className="text-2xl font-semibold mt-1">{totalCredits.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{t('admin.usage.activeOrgs', 'Active Organizations')}</p>
                    <p className="text-2xl font-semibold mt-1">{byOrg.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('admin.usage.dailyUsage', 'Daily Usage (Last 30 days)')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip />
                      <Area type="monotone" dataKey="totalCredits" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Credits" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('admin.usage.byEventType', 'Usage by Event Type')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={byType}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="eventType" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip />
                      <Bar dataKey="totalCredits" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Credits" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="orgs" className="space-y-4 mt-4">
          {summaryLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <PaginatedTable
              columns={orgColumns}
              data={byOrg}
              loading={summaryLoading}
              rowKey={(r) => r.workspaceId}
              emptyMessage={t('admin.usage.noOrgData', 'No organization usage data')}
            />
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <DateRangePicker
              value={dateRange}
              onChange={(r) => { setDateRange(r); resetPagination() }}
            />
            <FilterBar
              filters={[]}
            />
          </div>

          <PaginatedTable
            columns={eventColumns}
            data={events}
            loading={eventsLoading}
            rowKey={(r) => r.id}
            emptyMessage={t('admin.usage.noEvents', 'No usage events found')}
            skeletonRows={8}
            hasNextPage={!!nextCursor}
            hasPrevPage={cursorStack.current.length > 0}
            onNextPage={goNextPage}
            onPrevPage={goPrevPage}
            pageInfo={`${t('admin.usage.page', 'Page')} ${pageNum}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { UsageTrackingPage as default }

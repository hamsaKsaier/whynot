import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../../components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../components/ui/select';
import {
  Activity, TrendingUp, Zap, Download, Loader2, ChevronRight,
} from 'lucide-react';
import { getUsageSummary, getUsageByDay, getUsageRecent, getUsageExportCsvUrl } from '../../../services/api';
import { toast } from 'sonner';

interface UsageSummary {
  totalEvents: number;
  totalCharged: number;
  totalCredits: string;
  paygBalanceCents: string;
}

interface DayEntry {
  day: string;
  eventType: string;
  totalEvents: number;
  totalQuantity: number;
  totalCredits: string;
}

interface RecentEvent {
  id: string;
  eventType: string;
  quantity: number;
  creditsConsumed: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

type DateRange = '7d' | '30d' | '90d' | 'custom';

function getDateRange(range: DateRange): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case '7d': from.setDate(from.getDate() - 7); break;
    case '30d': from.setDate(from.getDate() - 30); break;
    case '90d': from.setDate(from.getDate() - 90); break;
    default: from.setDate(from.getDate() - 30);
  }
  return { from, to };
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  test_generation: '#0ea5e9',
  test_execution: '#f59e0b',
  qa_loop_iteration: '#8b5cf6',
};

function getEventColor(eventType: string): string {
  return EVENT_TYPE_COLORS[eventType] || '#64748b';
}

export const UsageTab: React.FC = () => {
  const { t, i18n } = useTranslation('settings');

  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [dayData, setDayData] = useState<DayEntry[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { from, to } = useMemo(() => {
    if (dateRange === 'custom' && customFrom && customTo) {
      return { from: new Date(customFrom), to: new Date(customTo) };
    }
    return getDateRange(dateRange);
  }, [dateRange, customFrom, customTo]);

  const fromStr = from.toISOString();
  const toStr = to.toISOString();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, byDayRes, recentRes] = await Promise.all([
        getUsageSummary(fromStr, toStr).catch(() => ({ summary: null })),
        getUsageByDay(fromStr, toStr).catch(() => ({ days: [] })),
        getUsageRecent(undefined, 50).catch(() => ({ entries: [], nextCursor: null })),
      ]);
      setSummary(summaryRes.summary);
      setDayData(byDayRes.days || []);
      setRecentEvents(recentRes.entries || []);
      setNextCursor(recentRes.nextCursor || null);
    } finally {
      setLoading(false);
    }
  }, [fromStr, toStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getUsageRecent(nextCursor, 50);
      setRecentEvents((prev) => [...prev, ...(res.entries || [])]);
      setNextCursor(res.nextCursor || null);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  const handleExportCsv = useCallback(() => {
    setExporting(true);
    try {
      const url = getUsageExportCsvUrl(fromStr, toStr);
      const token = localStorage.getItem('auth_token');
      const a = document.createElement('a');
      a.href = `${url}&_token=${token}`;
      a.download = `usage-export.csv`;
      a.click();
      toast.success(t('settings.usage.exportStarted', { defaultValue: 'Export started' }));
    } finally {
      setExporting(false);
    }
  }, [fromStr, toStr, t]);

  const stackedBarData = useMemo(() => {
    const dayMap = new Map<string, Record<string, number>>();
    const eventTypes = new Set<string>();

    for (const entry of dayData) {
      eventTypes.add(entry.eventType);
      const existing: Record<string, number | string> = dayMap.get(entry.day) || { day: entry.day };
      existing[entry.eventType] = entry.totalEvents;
      dayMap.set(entry.day, existing as Record<string, number>);
    }

    return {
      data: Array.from(dayMap.values()),
      eventTypes: Array.from(eventTypes),
    };
  }, [dayData]);

  const lineChartData = useMemo(() => {
    const dayMap = new Map<string, number>();
    for (const entry of dayData) {
      dayMap.set(entry.day, (dayMap.get(entry.day) || 0) + entry.totalEvents);
    }
    return Array.from(dayMap.entries())
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [dayData]);

  const formatDate = (label: unknown, _payload?: unknown) => {
    const dateStr = String(label);
    return new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  };

  const formatDateTime = (dateStr: string) => {
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  const formatEventType = (type: string) => {
    return t(`settings.usage.eventType.${type}`, { defaultValue: type.replace(/_/g, ' ') });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('settings.usage.last7d', { defaultValue: 'Last 7 days' })}</SelectItem>
              <SelectItem value="30d">{t('settings.usage.last30d', { defaultValue: 'Last 30 days' })}</SelectItem>
              <SelectItem value="90d">{t('settings.usage.last90d', { defaultValue: 'Last 90 days' })}</SelectItem>
              <SelectItem value="custom">{t('settings.usage.custom', { defaultValue: 'Custom' })}</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="flex-1 sm:flex-initial px-3 py-2 bg-card border border-border rounded-md text-foreground text-sm"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="flex-1 sm:flex-initial px-3 py-2 bg-card border border-border rounded-md text-foreground text-sm"
              />
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exporting} className="sm:ms-auto w-full sm:w-auto">
          {exporting ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <Download className="h-4 w-4 me-1" />}
          {t('settings.usage.exportCsv', { defaultValue: 'Export CSV' })}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t('settings.usage.totalEvents', { defaultValue: 'Total Events' })}</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {summary?.totalEvents?.toLocaleString(i18n.language) ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t('settings.usage.eventsCharged', { defaultValue: 'Events Charged' })}</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {summary?.totalCharged?.toLocaleString(i18n.language) ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t('settings.usage.paygBalance', { defaultValue: 'PAYG Balance' })}</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(
                parseInt(summary?.paygBalanceCents ?? '0', 10) / 100,
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked Bar Chart by Event Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('settings.usage.byType', { defaultValue: 'Events by Type' })}</CardTitle>
          </CardHeader>
          <CardContent>
            {stackedBarData.data.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t('settings.usage.noData', { defaultValue: 'No usage data for this period' })}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stackedBarData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tickFormatter={formatDate} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }}
                    labelFormatter={formatDate}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={formatEventType} />
                  {stackedBarData.eventTypes.map((type) => (
                    <Bar key={type} dataKey={type} stackId="events" fill={getEventColor(type)} name={type} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Line Chart by Day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('settings.usage.daily', { defaultValue: 'Daily Usage' })}</CardTitle>
          </CardHeader>
          <CardContent>
            {lineChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t('settings.usage.noData', { defaultValue: 'No usage data for this period' })}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tickFormatter={formatDate} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--foreground)' }}
                    labelFormatter={formatDate}
                  />
                  <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2} dot={false} name={t('settings.usage.totalEvents', { defaultValue: 'Total Events' })} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.usage.recentEvents', { defaultValue: 'Recent Events' })}</CardTitle>
          <CardDescription>{t('settings.usage.recentEventsDesc', { defaultValue: 'Most recent usage events across your workspace' })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-6">
              {t('settings.usage.noEvents', { defaultValue: 'No events recorded yet' })}
            </p>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">{t('settings.usage.eventTypeCol', { defaultValue: 'Event Type' })}</TableHead>
                      <TableHead className="text-end">{t('settings.usage.quantity', { defaultValue: 'Qty' })}</TableHead>
                      <TableHead className="text-end">{t('settings.usage.credits', { defaultValue: 'Credits' })}</TableHead>
                      <TableHead className="text-start">{t('settings.usage.date', { defaultValue: 'Date' })}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-start">
                          <Badge variant="outline" className="gap-1">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: getEventColor(event.eventType) }}
                            />
                            {formatEventType(event.eventType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">{event.quantity}</TableCell>
                        <TableCell className="text-end text-muted-foreground">{event.creditsConsumed}</TableCell>
                        <TableCell className="text-start text-muted-foreground text-sm">
                          {formatDateTime(event.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: cards */}
              <div className="sm:hidden px-4 pb-4 space-y-3">
                {recentEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="gap-1">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: getEventColor(event.eventType) }}
                        />
                        {formatEventType(event.eventType)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('settings.usage.quantity', { defaultValue: 'Qty' })}: {event.quantity}</span>
                      <span className="text-muted-foreground">{t('settings.usage.credits', { defaultValue: 'Credits' })}: {event.creditsConsumed}</span>
                    </div>
                  </div>
                ))}
              </div>

              {nextCursor && (
                <div className="flex justify-center py-4 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 me-1 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4 me-1 rtl:scale-x-[-1]" />
                    )}
                    {t('settings.usage.loadMore', { defaultValue: 'Load more' })}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

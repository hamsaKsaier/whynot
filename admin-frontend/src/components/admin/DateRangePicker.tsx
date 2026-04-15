import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { cn } from '../../lib/utils'

interface DateRange {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)

  const presets = [
    { label: t('admin.common.presets.last7Days'), days: 7 },
    { label: t('admin.common.presets.last30Days'), days: 30 },
    { label: t('admin.common.presets.last90Days'), days: 90 },
    { label: t('admin.common.presets.thisYear'), days: -1 },
  ]

  const displayLabel =
    value.from && value.to
      ? t('admin.common.dateRange', { from: value.from, to: value.to })
      : t('admin.common.selectDateRange')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
          <Calendar className="h-4 w-4" />
          <span className="text-sm">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80" align="end">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  onChange({
                    from: p.days === -1 ? startOfYear() : daysAgo(p.days),
                    to: today(),
                  })
                  setOpen(false)
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('admin.common.from')}</Label>
              <Input
                type="date"
                value={value.from}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('admin.common.to')}</Label>
              <Input
                type="date"
                value={value.to}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </div>
          </div>
          <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
            {t('admin.common.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

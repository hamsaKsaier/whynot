import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { Skeleton } from '../ui/skeleton'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Card, CardContent } from '../ui/card'
import { cn } from '../../lib/utils'

export interface Column<T> {
  key: string
  header: string
  className?: string
  render: (row: T) => React.ReactNode
  hideOnMobile?: boolean
}

interface PaginatedTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  rowKey: (row: T) => string
  skeletonRows?: number
  // Cursor pagination
  hasNextPage?: boolean
  hasPrevPage?: boolean
  onNextPage?: () => void
  onPrevPage?: () => void
  pageInfo?: string
  // Selection
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  // Row click
  onRowClick?: (row: T) => void
  className?: string
}

export function PaginatedTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage,
  rowKey,
  skeletonRows = 5,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  pageInfo,
  selectable,
  selectedIds,
  onSelectionChange,
  onRowClick,
  className,
}: PaginatedTableProps<T>) {
  const { t } = useTranslation('common')
  const resolvedEmptyMessage = emptyMessage ?? t('admin.common.noData')
  const allSelected = data.length > 0 && data.every((r) => selectedIds?.has(rowKey(r)))
  const someSelected = data.some((r) => selectedIds?.has(rowKey(r)))

  const toggleAll = () => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(data.map(rowKey)))
    }
  }

  const toggleRow = (id: string) => {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  const mobileColumns = columns.filter((col) => !col.hideOnMobile)
  const actionColumn = columns.find((col) => col.key === 'actions')

  return (
    <div className={cn('space-y-4', className)}>
      {/* Desktop table view */}
      <div className="hidden md:block rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label={t('admin.common.selectAll')}
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {selectable && (
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const id = rowKey(row)
                const selected = selectedIds?.has(id) ?? false
                return (
                  <TableRow
                    key={id}
                    data-state={selected ? 'selected' : undefined}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleRow(id)}
                          aria-label={t('admin.common.selectRow', { id })}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: skeletonRows }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))
        ) : data.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            {resolvedEmptyMessage}
          </div>
        ) : (
          data.map((row) => {
            const id = rowKey(row)
            const selected = selectedIds?.has(id) ?? false
            return (
              <Card
                key={id}
                data-state={selected ? 'selected' : undefined}
                className={cn(
                  onRowClick && 'cursor-pointer',
                  selected && 'ring-1 ring-primary',
                )}
                onClick={() => onRowClick?.(row)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {selectable && (
                        <div className="flex items-center gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleRow(id)}
                            aria-label={t('admin.common.selectRow', { id })}
                          />
                        </div>
                      )}
                      {mobileColumns
                        .filter((col) => col.key !== 'actions')
                        .map((col) => (
                          <div key={col.key} className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {col.header}
                            </span>
                            <span className="text-sm text-end truncate">
                              {col.render(row)}
                            </span>
                          </div>
                        ))}
                    </div>
                    {actionColumn && (
                      <div className="flex-shrink-0">{actionColumn.render(row)}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {(hasPrevPage || hasNextPage || pageInfo) && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{pageInfo}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={!hasPrevPage}
              onClick={onPrevPage}
              aria-label={t('admin.common.previousPage')}
            >
              <ChevronLeft className="h-4 w-4 rtl:scale-x-[-1]" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={!hasNextPage}
              onClick={onNextPage}
              aria-label={t('admin.common.nextPage')}
            >
              <ChevronRight className="h-4 w-4 rtl:scale-x-[-1]" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

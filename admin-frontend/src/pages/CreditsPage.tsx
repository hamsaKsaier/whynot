import { useState, useEffect, useCallback } from 'react'
import { Plus, Download, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { PaginatedTable, type Column } from '../components/admin/PaginatedTable'
import { ExportMenu } from '../components/admin/ExportMenu'
import { getAdminUsers, grantCredits } from '../services/api'

interface CreditRow {
  id: string
  name: string
  email: string
  workspace_name?: string
  workspace_id?: string
  credits: number
  plan_name?: string
}

const columns: Column<CreditRow>[] = [
  { key: 'name', header: 'User', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'email', header: 'Email', render: (r) => <span className="text-muted-foreground">{r.email}</span> },
  { key: 'plan', header: 'Plan', render: (r) => <span className="text-muted-foreground">{r.plan_name || '-'}</span> },
  { key: 'credits', header: 'Credits', className: 'text-end', render: (r) => <span className="font-medium">{r.credits}</span> },
]

export function CreditsPage() {
  const [users, setUsers] = useState<CreditRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [grantOpen, setGrantOpen] = useState(false)
  const [grantForm, setGrantForm] = useState({ workspaceId: '', amount: '', description: '' })
  const [granting, setGranting] = useState(false)
  const limit = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminUsers({ offset, limit })
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  const handleGrant = async () => {
    const amount = parseInt(grantForm.amount)
    if (!grantForm.workspaceId || !amount || amount <= 0) return
    setGranting(true)
    try {
      await grantCredits(grantForm.workspaceId, amount, grantForm.description || 'Admin bulk grant')
      setGrantOpen(false)
      setGrantForm({ workspaceId: '', amount: '', description: '' })
      await fetchData()
    } finally {
      setGranting(false)
    }
  }

  const handleExportCSV = () => {
    const header = 'name,email,plan,credits\n'
    const rows = users.map((u) => `${u.name},${u.email},${u.plan_name || ''},${u.credits}`)
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'credits.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Credits"
        description="Credit balances across all users"
        actions={
          <div className="flex gap-2">
            <ExportMenu onExportCSV={handleExportCSV} />
            <Button size="sm" onClick={() => setGrantOpen(true)}>
              <Plus className="h-4 w-4 me-1.5" />
              Grant Credits
            </Button>
          </div>
        }
      />

      <PaginatedTable
        columns={columns}
        data={users}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage="No users found"
        hasNextPage={offset + limit < total}
        hasPrevPage={offset > 0}
        onNextPage={() => setOffset(offset + limit)}
        onPrevPage={() => setOffset(Math.max(0, offset - limit))}
        pageInfo={totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : undefined}
      />

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>Grant credits to a specific workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ws-id">Workspace ID</Label>
              <Input
                id="ws-id"
                value={grantForm.workspaceId}
                onChange={(e) => setGrantForm((f) => ({ ...f, workspaceId: e.target.value }))}
                placeholder="workspace-uuid"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={grantForm.amount}
                onChange={(e) => setGrantForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={grantForm.description}
                onChange={(e) => setGrantForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Reason for credit grant..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button onClick={handleGrant} disabled={granting}>
              {granting && <Loader2 className="h-4 w-4 me-1.5 animate-spin" />}
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { CreditsPage as default }

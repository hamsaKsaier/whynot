import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Archive, RotateCcw, Upload } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { ConfirmDialog } from '../components/admin/ConfirmDialog'
import { formatCents } from '../lib/money'
import { getAdminPlans, archivePlan, restorePlan, syncPlanToStripe } from '../services/api'

export function PlansPage() {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [archiveTarget, setArchiveTarget] = useState<any>(null)

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const data = await getAdminPlans()
      setPlans(data.plans || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleArchive = async () => {
    if (!archiveTarget) return
    await archivePlan(archiveTarget.id)
    setArchiveTarget(null)
    await fetchPlans()
  }

  const handleRestore = async (id: string) => {
    await restorePlan(id)
    await fetchPlans()
  }

  const handleSyncStripe = async (id: string) => {
    try {
      await syncPlanToStripe(id)
      await fetchPlans()
    } catch (err: any) {
      alert(`Stripe sync failed: ${err.response?.data?.error || err.message}`)
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Plans"
        actions={
          <Button asChild size="sm">
            <Link to="/plans/new">
              <Plus className="h-4 w-4 me-1.5" />
              New Plan
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No plans created yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan: any) => (
            <Card key={plan.id} className={plan.is_archived ? 'opacity-60' : undefined}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{plan.name}</h3>
                      {plan.is_archived && <Badge variant="secondary">Archived</Badge>}
                      {!plan.is_public && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800">
                          Hidden
                        </Badge>
                      )}
                      {plan.is_custom && (
                        <Badge variant="outline" className="bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.price_cents === 0 ? 'Free' : `${formatCents(plan.price_cents)}/${plan.billing_interval}`}
                      {' · '}{plan.credits_per_period} credits
                      {plan.trial_days > 0 && ` · ${plan.trial_days}-day trial`}
                      {' · '}{plan.subscriber_count || 0} subscribers
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleSyncStripe(plan.id)} title="Sync to Stripe">
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild title="Edit">
                      <Link to={`/plans/${plan.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    {plan.is_archived ? (
                      <Button variant="ghost" size="icon" onClick={() => handleRestore(plan.id)} title="Restore">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => setArchiveTarget(plan)} title="Archive">
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {plan.features && plan.features.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {plan.features.map((f: any) => (
                      <Badge key={f.feature_key} variant="secondary" className="font-mono text-xs">
                        {f.feature_key}: {f.feature_value}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}
        title="Archive Plan"
        description={`Are you sure you want to archive "${archiveTarget?.name}"? Existing subscribers won't be affected, but new subscriptions will be disabled.`}
        confirmText="Archive"
        variant="destructive"
        onConfirm={handleArchive}
      />
    </div>
  )
}

export { PlansPage as default }

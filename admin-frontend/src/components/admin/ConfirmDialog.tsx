import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  typeToConfirm?: string
  variant?: 'destructive' | 'default'
  loading?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  typeToConfirm,
  variant = 'default',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')
  const [typed, setTyped] = useState('')
  const resolvedConfirmText = confirmText ?? t('admin.common.confirm')

  const canConfirm = !typeToConfirm || typed === typeToConfirm

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm()
    setTyped('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped('')
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {typeToConfirm && (
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-input">
              {t('admin.common.typeToConfirm', { text: typeToConfirm })}
            </Label>
            <Input
              id="confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typeToConfirm}
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? t('admin.common.processing') : resolvedConfirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

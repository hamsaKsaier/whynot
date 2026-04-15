import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Loader2, Globe } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { AdminPageHeader } from '../components/admin/AdminPageHeader'
import { PaginatedTable, type Column } from '../components/admin/PaginatedTable'
import { ConfirmDialog } from '../components/admin/ConfirmDialog'
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../services/api'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
]

interface Announcement {
  id: string
  title: string
  body?: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_active: boolean
  starts_at?: string
  ends_at?: string
  created_at: string
}

interface TranslationEntry {
  title: string
  body: string
}

type Translations = Record<string, TranslationEntry>

interface FormState {
  type: 'info' | 'warning' | 'success' | 'error'
  is_active: boolean
  starts_at: string
  ends_at: string
  translations: Translations
}

function emptyTranslations(): Translations {
  const t: Translations = {}
  for (const lang of LANGUAGES) {
    t[lang.code] = { title: '', body: '' }
  }
  return t
}

const emptyForm: FormState = {
  type: 'info',
  is_active: true,
  starts_at: '',
  ends_at: '',
  translations: emptyTranslations(),
}

function parseTranslations(announcement: Announcement): Translations {
  const base = emptyTranslations()
  base.en.title = announcement.title
  if (announcement.body) {
    try {
      const parsed = JSON.parse(announcement.body)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        for (const lang of LANGUAGES) {
          if (parsed[lang.code]) {
            base[lang.code] = {
              title: parsed[lang.code].title || '',
              body: parsed[lang.code].body || '',
            }
          }
        }
        return base
      }
    } catch {
      // not JSON — treat as plain English body
    }
    base.en.body = announcement.body
  }
  return base
}

function serializeTranslations(translations: Translations): { title: string; body: string } {
  return {
    title: translations.en?.title || '',
    body: JSON.stringify(translations),
  }
}

const typeBadgeStyles: Record<string, string> = {
  info: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  warning: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800',
  success: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  error: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
}

const fmt = (iso?: string) =>
  iso ? Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)) : ''

export function AnnouncementsPage() {
  const { t } = useTranslation('admin')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [langTab, setLangTab] = useState('en')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAnnouncements()
      setAnnouncements(data.announcements || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setLangTab('en')
    setDialogOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setForm({
      type: a.type,
      is_active: a.is_active,
      starts_at: a.starts_at ? a.starts_at.slice(0, 16) : '',
      ends_at: a.ends_at ? a.ends_at.slice(0, 16) : '',
      translations: parseTranslations(a),
    })
    setEditingId(a.id)
    setLangTab('en')
    setDialogOpen(true)
  }

  const updateTranslation = (lang: string, field: 'title' | 'body', value: string) => {
    setForm((f) => ({
      ...f,
      translations: {
        ...f.translations,
        [lang]: { ...f.translations[lang], [field]: value },
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.translations.en?.title?.trim()) return
    setSaving(true)
    try {
      const { title, body } = serializeTranslations(form.translations)
      const payload = {
        title,
        body,
        type: form.type,
        is_active: form.is_active,
        starts_at: form.starts_at || undefined,
        ends_at: form.ends_at || undefined,
      }
      if (editingId) {
        await updateAnnouncement(editingId, payload)
      } else {
        await createAnnouncement(payload)
      }
      setDialogOpen(false)
      fetchAll()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteAnnouncement(deleteTarget.id)
    setDeleteTarget(null)
    fetchAll()
  }

  const translatedCount = (a: Announcement): number => {
    const tr = parseTranslations(a)
    return LANGUAGES.filter(l => tr[l.code]?.title?.trim()).length
  }

  const columns: Column<Announcement>[] = [
    { key: 'title', header: t('admin.announcements.title', 'Title'), render: (r) => <span className="font-medium">{r.title}</span> },
    {
      key: 'type',
      header: t('admin.announcements.type', 'Type'),
      render: (r) => (
        <Badge variant="outline" className={`capitalize ${typeBadgeStyles[r.type] || ''}`}>
          {r.type}
        </Badge>
      ),
    },
    {
      key: 'langs',
      header: t('admin.announcements.languages', 'Languages'),
      hideOnMobile: true,
      render: (r) => (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          {translatedCount(r)}/5
        </span>
      ),
    },
    {
      key: 'active',
      header: t('admin.announcements.active', 'Active'),
      render: (r) => (
        <span className={`h-2 w-2 rounded-full inline-block ${r.is_active ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
      ),
    },
    {
      key: 'schedule',
      header: t('admin.announcements.schedule', 'Schedule'),
      hideOnMobile: true,
      render: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.starts_at ? fmt(r.starts_at) : t('admin.announcements.immediate', 'Immediate')}
          {r.ends_at ? ` — ${fmt(r.ends_at)}` : ''}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(r) }} title={t('admin.announcements.edit', 'Edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }} title={t('admin.announcements.delete', 'Delete')}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={t('admin.announcements.pageTitle', 'Announcements')}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 me-1.5" />
            {t('admin.announcements.new', 'New Announcement')}
          </Button>
        }
      />

      <PaginatedTable
        columns={columns}
        data={announcements}
        loading={loading}
        rowKey={(r) => r.id}
        emptyMessage={t('admin.announcements.empty', 'No announcements')}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t('admin.announcements.editTitle', 'Edit Announcement')
                : t('admin.announcements.newTitle', 'New Announcement')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs value={langTab} onValueChange={setLangTab}>
              <TabsList className="w-full justify-start">
                {LANGUAGES.map((lang) => (
                  <TabsTrigger key={lang.code} value={lang.code} className="gap-1.5">
                    <span>{lang.flag}</span>
                    <span className="hidden sm:inline">{lang.label}</span>
                    <span className="sm:hidden">{lang.code.toUpperCase()}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {LANGUAGES.map((lang) => (
                <TabsContent key={lang.code} value={lang.code} className="space-y-3 mt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`ann-title-${lang.code}`}>
                      {t('admin.announcements.titleLabel', 'Title')} ({lang.label})
                      {lang.code === 'en' && <span className="text-destructive ms-1">*</span>}
                    </Label>
                    <Input
                      id={`ann-title-${lang.code}`}
                      value={form.translations[lang.code]?.title || ''}
                      onChange={(e) => updateTranslation(lang.code, 'title', e.target.value)}
                      required={lang.code === 'en'}
                      dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`ann-body-${lang.code}`}>
                      {t('admin.announcements.bodyLabel', 'Body')} ({lang.label})
                    </Label>
                    <Textarea
                      id={`ann-body-${lang.code}`}
                      value={form.translations[lang.code]?.body || ''}
                      onChange={(e) => updateTranslation(lang.code, 'body', e.target.value)}
                      rows={3}
                      dir={lang.code === 'ar' ? 'rtl' : 'ltr'}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('admin.announcements.typeLabel', 'Type')}</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ann-active"
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  />
                  <Label htmlFor="ann-active" className="cursor-pointer">
                    {t('admin.announcements.activeLabel', 'Active')}
                  </Label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ann-start">{t('admin.announcements.startsAt', 'Starts At')}</Label>
                <Input
                  id="ann-start"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-end">{t('admin.announcements.endsAt', 'Ends At')}</Label>
                <Input
                  id="ann-end"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('admin.announcements.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 me-1.5 animate-spin" />}
                {editingId
                  ? t('admin.announcements.update', 'Update')
                  : t('admin.announcements.create', 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title={t('admin.announcements.deleteTitle', 'Delete Announcement')}
        description={t('admin.announcements.deleteConfirm', `Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`)}
        confirmText={t('admin.announcements.deleteBtn', 'Delete')}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}

export { AnnouncementsPage as default }

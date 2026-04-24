import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { X, Shield } from "lucide-react"
import { useFeatureFlag } from "@/hooks/useFeatureFlag"
import { Button } from "@/components/ui/button"

const DISMISS_KEY = "recon.announcement.dismissed"
const SEEN_KEY = "recon.announcement.seen"
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000

function isDismissedRecently(now: number): boolean {
  if (typeof localStorage === "undefined") return false
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const ts = Number.parseInt(raw, 10)
  if (!Number.isFinite(ts)) return false
  return now - ts < DISMISS_TTL_MS
}

function hasSeenRecon(): boolean {
  if (typeof localStorage === "undefined") return false
  return localStorage.getItem(SEEN_KEY) === "1"
}

export function ReconAnnouncementBanner() {
  const { t } = useTranslation("announcements")
  const enabled = useFeatureFlag("recon_enabled")
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setVisible(false)
      return
    }
    const now = Date.now()
    setVisible(!isDismissedRecently(now) && !hasSeenRecon())
  }, [enabled])

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore storage errors (private mode, quota)
    }
    setLeaving(true)
    window.setTimeout(() => setVisible(false), 150)
  }, [])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label={t("announcements.recon.headline")}
      data-testid="recon-announcement-banner"
      className={
        "border-b bg-muted/50 transition-opacity duration-150 " +
        (leaving ? "opacity-0" : "opacity-100")
      }
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3 sm:items-center">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:mt-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {t("announcements.recon.headline")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("announcements.recon.subheadline")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button asChild size="sm" className="rounded-md">
            <Link to="/recon">{t("announcements.recon.cta")}</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            aria-label={t("announcements.recon.dismiss")}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

import { Suspense, useEffect, type ReactNode } from "react"
import { useFeatureFlag } from "@/hooks/useFeatureFlag"
import { NotFoundPage } from "@/pages/NotFoundPage"

export function ReconRoute({ children }: { children: ReactNode }) {
  const enabled = useFeatureFlag("recon_enabled")

  useEffect(() => {
    if (!enabled) return
    try {
      localStorage.setItem("recon.announcement.seen", "1")
    } catch {
      // ignore storage errors
    }
  }, [enabled])

  if (!enabled) return <NotFoundPage />
  return <Suspense fallback={null}>{children}</Suspense>
}

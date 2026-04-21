import { Suspense, type ReactNode } from "react"
import { useFeatureFlag } from "@/hooks/useFeatureFlag"
import { NotFoundPage } from "@/pages/NotFoundPage"

export function ReconRoute({ children }: { children: ReactNode }) {
  const enabled = useFeatureFlag("recon_enabled")
  if (!enabled) return <NotFoundPage />
  return <Suspense fallback={null}>{children}</Suspense>
}

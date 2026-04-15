import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthShell } from "@/components/layout/AuthShell"
import apiClient from "@/services/api"

type VerifyState = "verifying" | "success" | "error"

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""
  const [state, setState] = useState<VerifyState>(token ? "verifying" : "error")
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "Invalid verification link."
  )

  useEffect(() => {
    if (!token) return

    let cancelled = false

    apiClient
      .post("/auth/verify-email", { token })
      .then(() => {
        if (!cancelled) setState("success")
      })
      .catch((err) => {
        if (!cancelled) {
          setState("error")
          setErrorMessage(
            err?.response?.data?.error ||
              err?.message ||
              "Verification failed. The link may have expired."
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <AuthShell>
      {state === "verifying" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Verifying your email…
          </p>
        </div>
      )}

      {state === "success" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">
              Email verified
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your email has been verified successfully. You can now sign in.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-lg bg-destructive/10 p-3">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">
              Verification failed
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {errorMessage}
            </p>
          </div>
          <Button variant="outline" asChild className="w-full">
            <Link to="/login">Back to Login</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  )
}

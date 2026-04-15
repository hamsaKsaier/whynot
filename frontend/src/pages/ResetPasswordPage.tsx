import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle, Loader2, Lock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthShell } from "@/components/layout/AuthShell"
import { resetPassword } from "@/services/api"

function createResetSchema(t: (key: string) => string) {
  return z
    .object({
      newPassword: z.string().min(8, t("auth.common.passwordMinLength")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("auth.signup.error.passwordMismatch"),
      path: ["confirmPassword"],
    })
}

type ResetFormData = z.infer<ReturnType<typeof createResetSchema>>

export function ResetPasswordPage() {
  const { t } = useTranslation("common")
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const resetSchema = createResetSchema(t)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  })

  const onSubmit = async (data: ResetFormData) => {
    setServerError(null)
    try {
      await resetPassword(token, data.newPassword)
      setSuccess(true)
    } catch (err: any) {
      setServerError(
        err?.response?.data?.error || err?.message || t("auth.signup.error.generic")
      )
    }
  }

  return (
    <AuthShell>
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        {t("auth.resetPassword.title")}
      </h2>

      {success ? (
        <div>
          <div className="mb-4 flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                {t("auth.resetPassword.success.title")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("auth.resetPassword.success.description")}
              </p>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">{t("auth.resetPassword.success.loginLink")}</Link>
          </Button>
        </div>
      ) : !token ? (
        <div>
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {t("auth.resetPassword.error.invalidLink")}
            </AlertDescription>
          </Alert>
          <Button variant="outline" asChild className="w-full">
            <Link to="/login">{t("auth.resetPassword.error.backToLogin")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("auth.resetPassword.newPasswordLabel")}</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                enterKeyHint="next"
                autoFocus
                placeholder={t("auth.common.passwordPlaceholder")}
                className="ps-10"
                {...register("newPassword")}
              />
            </div>
            {errors.newPassword && (
              <p className="text-xs text-destructive">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("auth.resetPassword.confirmPasswordLabel")}</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                enterKeyHint="done"
                placeholder={t("auth.common.passwordPlaceholder")}
                className="ps-10"
                {...register("confirmPassword")}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t("auth.resetPassword.submitting")}
              </>
            ) : (
              t("auth.resetPassword.submit")
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

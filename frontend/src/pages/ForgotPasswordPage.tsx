import { useState } from "react"
import { Link } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthShell } from "@/components/layout/AuthShell"
import { forgotPassword } from "@/services/api"

function createForgotSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t("auth.common.emailValidation")),
  })
}

type ForgotFormData = z.infer<ReturnType<typeof createForgotSchema>>

export function ForgotPasswordPage() {
  const { t } = useTranslation("common")
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const forgotSchema = createForgotSchema(t)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotFormData) => {
    setServerError(null)
    try {
      await forgotPassword(data.email)
      setSent(true)
    } catch (err: any) {
      setServerError(
        err?.response?.data?.error || err?.message || t("auth.signup.error.generic")
      )
    }
  }

  return (
    <AuthShell>
      <Link
        to="/login"
        className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl:scale-x-[-1]" />
        {t("auth.forgotPassword.backToLogin")}
      </Link>

      <h2 className="mb-2 text-lg font-semibold text-foreground">
        {t("auth.forgotPassword.title")}
      </h2>

      {sent ? (
        <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              {t("auth.forgotPassword.success.title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("auth.forgotPassword.success.description")}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("auth.forgotPassword.description")}
          </p>

          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.forgotPassword.emailLabel")}</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                enterKeyHint="done"
                autoFocus
                placeholder={t("auth.common.emailPlaceholder")}
                className="ps-10"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
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
                {t("auth.forgotPassword.submitting")}
              </>
            ) : (
              t("auth.forgotPassword.submit")
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

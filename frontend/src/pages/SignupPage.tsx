import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Github, Loader2, Mail, Lock, User } from "lucide-react"
import { useTranslation, Trans } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AuthShell } from "@/components/layout/AuthShell"
import { useAuth } from "@/contexts/AuthContext"
import { config } from "@/config"

function createSignupSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(1, t("auth.signup.error.nameRequired")),
      email: z.string().email(t("auth.common.emailValidation")),
      password: z.string().min(8, t("auth.common.passwordMinLength")),
      confirmPassword: z.string(),
      acceptTerms: z.literal(true, {
        errorMap: () => ({ message: t("auth.signup.error.termsRequired") }),
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.signup.error.passwordMismatch"),
      path: ["confirmPassword"],
    })
}

type SignupFormData = z.infer<ReturnType<typeof createSignupSchema>>

export function SignupPage() {
  const { t } = useTranslation("common")
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const signupSchema = createSignupSchema(t)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { acceptTerms: false as any },
  })

  const acceptTerms = watch("acceptTerms")

  const onSubmit = async (data: SignupFormData) => {
    setServerError(null)
    try {
      await registerUser(data.email, data.password, data.name)
      navigate("/app", { replace: true })
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        t("auth.signup.error.generic")
      setServerError(msg)
    }
  }

  return (
    <AuthShell>
      <h2 className="mb-6 text-lg font-semibold text-foreground">
        {t("auth.signup.title")}
      </h2>

      <div className="space-y-3">
        <Button variant="outline" className="w-full" asChild>
          <a href={`${config.apiUrl}/auth/github`}>
            <Github className="me-2 h-4 w-4" />
            {t("auth.login.oauth.github")}
          </a>
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <a href={`${config.apiUrl}/auth/google`}>
            <svg className="me-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t("auth.login.oauth.google")}
          </a>
        </Button>
      </div>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">{t("auth.login.divider")}</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t("auth.signup.nameLabel")}</Label>
          <div className="relative">
            <User className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              autoComplete="name"
              enterKeyHint="next"
              autoFocus
              placeholder={t("auth.signup.namePlaceholder")}
              className="ps-10"
              {...register("name")}
            />
          </div>
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.signup.emailLabel")}</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              enterKeyHint="next"
              placeholder={t("auth.common.emailPlaceholder")}
              className="ps-10"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.signup.passwordLabel")}</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              enterKeyHint="next"
              placeholder={t("auth.common.passwordPlaceholder")}
              className="ps-10"
              {...register("password")}
            />
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("auth.signup.confirmPasswordLabel")}</Label>
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

        <div className="flex min-h-[44px] items-start gap-2 py-2">
          <Checkbox
            id="terms"
            checked={acceptTerms}
            onCheckedChange={(checked) =>
              setValue("acceptTerms", checked === true ? true : (false as any), {
                shouldValidate: true,
              })
            }
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="cursor-pointer text-sm font-normal leading-snug">
            <Trans
              i18nKey="auth.signup.acceptTerms"
              ns="common"
              components={{
                termsLink: <a href="/terms" target="_blank" className="text-primary underline" />,
                privacyLink: <a href="/privacy" target="_blank" className="text-primary underline" />,
              }}
            />
          </Label>
        </div>
        {errors.acceptTerms && (
          <p className="text-xs text-destructive">
            {errors.acceptTerms.message}
          </p>
        )}

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t("auth.signup.submitting")}
            </>
          ) : (
            t("auth.signup.submit")
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.signup.loginPrompt")}{" "}
        <Link
          to="/login"
          className="font-medium text-primary transition-colors duration-150 hover:text-primary/80"
        >
          {t("auth.signup.loginLink")}
        </Link>
      </p>
    </AuthShell>
  )
}

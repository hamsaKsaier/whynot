import { useTranslation } from "react-i18next"
import { useThemeContext } from "../ThemeProvider"
import { cn } from "@/lib/utils"

const SIZE_MAP = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
} as const

type LogoSize = keyof typeof SIZE_MAP

interface LogoProps {
  className?: string
  size?: LogoSize
  variant?: "full" | "mark"
}

export function Logo({ className, size = "md", variant = "full" }: LogoProps) {
  const { t } = useTranslation("common")
  const { resolvedTheme } = useThemeContext()

  if (variant === "mark") {
    return (
      <img
        src="/favicon.svg"
        alt={t("common.logoAlt")}
        aria-label={t("common.logoAlt")}
        className={cn(SIZE_MAP[size], "w-auto", className)}
      />
    )
  }

  const src = resolvedTheme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"

  return (
    <img
      src={src}
      alt={t("common.logoAlt")}
      aria-label={t("common.logoAlt")}
      className={cn(SIZE_MAP[size], "w-auto", className)}
    />
  )
}

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { Menu, CreditCard, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher"
import { getBillingCredits } from "@/services/api"
import { cn } from "@/lib/utils"

interface HeaderProps {
  onMenuToggle?: () => void
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function getBreadcrumbs(pathname: string, t: (key: string) => string) {
  const paths = pathname.split("/").filter(Boolean)

  if (paths.length === 0) {
    return [{ label: t("common.nav.dashboard"), path: "/app" }]
  }

  const labelMap: Record<string, string> = {
    "qa-loop": t("common.nav.qaLoop"),
    "test-results": t("common.nav.testResults"),
    settings: t("common.nav.settings"),
    "architecture-flow": t("common.nav.architectureFlow"),
    projects: t("common.nav.projects"),
    performance: t("common.nav.performance"),
    monitors: t("common.nav.monitors"),
    app: t("common.nav.dashboard"),
  }

  return paths.map((segment, index) => ({
    label: labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
    path: "/" + paths.slice(0, index + 1).join("/"),
  }))
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { t } = useTranslation("common")
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const breadcrumbs = getBreadcrumbs(pathname, t)

  useEffect(() => {
    if (!user) return
    getBillingCredits()
      .then((data) => {
        const bal = data?.balance
        setCreditBalance(
          typeof bal === "object" && bal !== null ? bal.balance ?? 0 : bal ?? null
        )
      })
      .catch(() => {})
  }, [user, pathname])

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6" role="banner">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuToggle}
          aria-label={t("common.header.openNavMenu")}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <WorkspaceSwitcher />

        <Separator orientation="vertical" className="mx-1 h-5" />

        <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex items-center gap-1">
              {index > 0 && <span>/</span>}
              <Link
                to={crumb.path}
                className={cn(
                  "transition-colors duration-150 hover:text-foreground",
                  index === breadcrumbs.length - 1 && "font-medium text-foreground"
                )}
              >
                {crumb.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {creditBalance !== null && (
          <Link
            to="/settings?tab=billing"
            className={cn(
              "hidden items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 sm:inline-flex",
              creditBalance <= 10
                ? "bg-destructive/10 text-destructive"
                : creditBalance <= 50
                  ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                  : "bg-green-500/10 text-green-700 dark:text-green-400"
            )}
          >
            <CreditCard className="h-3 w-3" />
            {t("common.header.credits", { count: creditBalance })}
          </Link>
        )}

        <LanguageSwitcher />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name} />
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {user ? getInitials(user.name) : "?"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {user && (
              <>
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link to="/settings">{t("common.header.settings")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="me-2 h-4 w-4 rtl:scale-x-[-1]" />
              {t("common.header.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

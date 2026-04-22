import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  DollarSign,
  BarChart3,
  Bell,
  FileText,
  Settings,
  Package,
  Shield,
  Menu,
  LogOut,
  ChevronLeft,
  Flag,
  Cpu,
  Receipt,
  Activity,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { ScrollArea } from '../ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Avatar, AvatarFallback } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { useAuth } from '../../contexts/AuthContext'
import { useThemeContext } from '../ThemeProvider'
import { useDirectionContext } from '../DirectionProvider'
import { cn } from '../../lib/utils'
import { getHostnameMode } from '../../lib/hostname'
import { LanguageSwitcher } from '../LanguageSwitcher'

interface NavItem {
  icon: React.ElementType
  labelKey: string
  path: string
  disabled?: boolean
  tooltipKey?: string
}

interface NavSection {
  titleKey: string | null
  items: NavItem[]
}

const allNavSections: NavSection[] = [
  {
    titleKey: null,
    items: [
      { icon: LayoutDashboard, labelKey: 'admin.nav.dashboard', path: '/' },
    ],
  },
  {
    titleKey: 'admin.nav.sections.platform',
    items: [
      { icon: Users, labelKey: 'admin.nav.users', path: '/users' },
      { icon: Building2, labelKey: 'admin.nav.organizations', path: '/organizations' },
    ],
  },
  {
    titleKey: 'admin.nav.sections.billing',
    items: [
      { icon: Package, labelKey: 'admin.nav.plans', path: '/plans' },
      { icon: CreditCard, labelKey: 'admin.nav.subscriptions', path: '/subscriptions' },
      { icon: DollarSign, labelKey: 'admin.nav.credits', path: '/credits' },
      { icon: Receipt, labelKey: 'admin.nav.billingConfig', path: '/billing-config' },
    ],
  },
  {
    titleKey: 'admin.nav.sections.flagsAi',
    items: [
      { icon: Flag, labelKey: 'admin.nav.featureFlags', path: '/feature-flags' },
      { icon: Cpu, labelKey: 'admin.nav.aiProviders', path: '/ai-providers' },
    ],
  },
  {
    titleKey: 'admin.nav.sections.insights',
    items: [
      { icon: FileText, labelKey: 'admin.nav.auditLog', path: '/audit-log' },
      { icon: BarChart3, labelKey: 'admin.nav.analytics', path: '/analytics' },
      { icon: Activity, labelKey: 'admin.nav.usage', path: '/usage' },
    ],
  },
  {
    titleKey: 'admin.nav.sections.content',
    items: [
      { icon: Bell, labelKey: 'admin.nav.announcements', path: '/announcements' },
    ],
  },
  {
    titleKey: 'admin.nav.sections.settings',
    items: [
      { icon: Settings, labelKey: 'admin.nav.systemSettings', path: '/settings' },
    ],
  },
]

const superadminSectionKeys = new Set([
  'admin.nav.sections.platform',
  'admin.nav.sections.billing',
  'admin.nav.sections.flagsAi',
  'admin.nav.sections.settings',
  null,
]);

function getNavSections(): NavSection[] {
  if (getHostnameMode() === 'superadmin') {
    return allNavSections.filter(s => superadminSectionKeys.has(s.titleKey));
  }
  return allNavSections;
}

function SidebarNav({
  collapsed,
  onToggleCollapse,
  onMobileClose,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  onMobileClose?: () => void
}) {
  const location = useLocation()
  const { t } = useTranslation('admin')
  const navSections = getNavSections()
  const hostnameMode = getHostnameMode()
  const { direction } = useDirectionContext()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        dir={direction}
        className={cn(
          'flex h-full flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-3">
          {!collapsed && (
            <Link
              to="/"
              className="flex items-center gap-2 px-2"
              onClick={onMobileClose}
            >
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-semibold">
                {hostnameMode === 'superadmin' ? t('admin.nav.superadminTitle') : t('admin.nav.title')}
              </span>
            </Link>
          )}
          {collapsed && (
            <Link to="/" className="mx-auto" onClick={onMobileClose}>
              <Shield className="h-5 w-5 text-primary" />
            </Link>
          )}
          {!onMobileClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={cn('h-8 w-8', collapsed ? 'mx-auto' : 'ms-auto')}
              aria-label={t('admin.nav.toggleSidebar')}
            >
              <ChevronLeft
                className={cn(
                  'h-4 w-4 transition-transform duration-150 rtl:scale-x-[-1]',
                  collapsed && 'rotate-180'
                )}
              />
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="space-y-4 px-2">
            {navSections.map((section, si) => (
              <div key={si}>
                {section.titleKey && !collapsed && (
                  <p className="mb-1 px-3 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                    {t(section.titleKey)}
                  </p>
                )}
                {section.titleKey && collapsed && <Separator className="my-2" />}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const active = !item.disabled && isActive(item.path)
                    const label = t(item.labelKey)
                    const linkContent = (
                      <span
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                          active
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : item.disabled
                              ? 'text-sidebar-foreground/50 cursor-not-allowed'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          collapsed && 'justify-center px-0'
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        {!collapsed && <span>{label}</span>}
                      </span>
                    )

                    if (item.disabled) {
                      return (
                        <Tooltip key={item.path}>
                          <TooltipTrigger asChild>
                            <div>{linkContent}</div>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {item.tooltipKey ? t(item.tooltipKey) : label}
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    if (collapsed) {
                      return (
                        <Tooltip key={item.path}>
                          <TooltipTrigger asChild>
                            <Link to={item.path} onClick={onMobileClose}>
                              {linkContent}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            {label}
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return (
                      <Link key={item.path} to={item.path} onClick={onMobileClose}>
                        {linkContent}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {!collapsed && (
          <div className="border-t border-sidebar-border px-4 py-3 text-xs text-sidebar-foreground/50">
            WhyNot Admin v2.0
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export function AdminShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const { theme, setTheme } = useThemeContext()
  const { t } = useTranslation('admin')

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'A'

  return (
    <div className="flex h-screen bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4">
        {t('admin.nav.skipToContent')}
      </a>

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <SidebarNav
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
        />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">{t('admin.nav.navigation')}</SheetTitle>
          <SidebarNav
            collapsed={false}
            onToggleCollapse={() => {}}
            onMobileClose={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-3 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileOpen(true)}
            aria-label={t('admin.nav.openNavigation')}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden md:block" />

          <div className="flex items-center gap-1.5 sm:gap-3">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="text-muted-foreground"
              aria-label={t('admin.nav.toggleTheme')}
            >
              {theme === 'dark' ? '☀' : '🌙'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{user?.name}</span>
                  <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                    {t('admin.nav.superadmin')}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="h-4 w-4 me-2 rtl:scale-x-[-1]" />
                  {t('admin.nav.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-y-auto" role="main">
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

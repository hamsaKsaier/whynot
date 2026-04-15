import { Link, useLocation } from "react-router-dom"
import {
  Home,
  FolderOpen,
  Zap,
  ClipboardList,
  Activity,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onMobileClose?: () => void
}

const NAV_ITEMS = [
  { icon: Zap, label: "QA Loop", path: "/qa-loop" },
  { icon: BarChart2, label: "Performance", path: "/performance" },
  { icon: Home, label: "Dashboard", path: "/app" },
  { icon: FolderOpen, label: "Projects", path: "/projects" },
  { icon: ClipboardList, label: "Test Results", path: "/test-results" },
  { icon: Activity, label: "Monitors", path: "/monitors" },
] as const

const BOTTOM_ITEMS = [
  { icon: Settings, label: "Settings", path: "/settings" },
] as const

function isActive(pathname: string, itemPath: string) {
  if (itemPath === "/") return pathname === "/"
  return pathname.startsWith(itemPath)
}

function NavItem({
  icon: Icon,
  label,
  path,
  active,
  collapsed,
  onClick,
}: {
  icon: typeof Home
  label: string
  path: string
  active: boolean
  collapsed: boolean
  onClick?: () => void
}) {
  const link = (
    <Link
      to={path}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}

export function Sidebar({ collapsed, onToggleCollapse, onMobileClose }: SidebarProps) {
  const { pathname } = useLocation()

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "flex h-full flex-col border-e bg-sidebar-background text-sidebar-foreground transition-[width] duration-150",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-3">
          {!collapsed && (
            <Link to="/app" className="flex items-center gap-2">
              <img src="/logo.svg" alt="WhyNot" className="h-6" />
            </Link>
          )}
          {collapsed && (
            <Link to="/app" className="mx-auto">
              <img src="/favicon.svg" alt="WhyNot" className="h-6 w-6" />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 rtl:scale-x-[-1]" />
            ) : (
              <ChevronLeft className="h-4 w-4 rtl:scale-x-[-1]" />
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 py-3">
          <nav
            className="space-y-1 px-2"
            role="navigation"
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.path}
                {...item}
                active={isActive(pathname, item.path)}
                collapsed={collapsed}
                onClick={onMobileClose}
              />
            ))}
          </nav>
        </ScrollArea>

        <Separator />
        <div className="px-2 py-3">
          {BOTTOM_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              {...item}
              active={isActive(pathname, item.path)}
              collapsed={collapsed}
              onClick={onMobileClose}
            />
          ))}
        </div>
      </aside>
    </TooltipProvider>
  )
}

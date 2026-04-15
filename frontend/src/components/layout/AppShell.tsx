import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import { Footer } from "./Footer"

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      <Header onMenuToggle={() => setMobileOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
          />
        </div>

        {/* Mobile sidebar (Sheet) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-60 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar
              collapsed={false}
              onToggleCollapse={() => {}}
              onMobileClose={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          role="main"
        >
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}

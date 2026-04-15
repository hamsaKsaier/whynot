import { Separator } from "@/components/ui/separator"

const APP_VERSION = import.meta.env.VITE_APP_VERSION || "2.0.0"

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <Separator />
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground sm:px-6">
        <span>WhyNot QA v{APP_VERSION}</span>
        <div className="flex items-center gap-4">
          <a
            href="https://docs.whynot.qa"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150 hover:text-foreground"
          >
            Docs
          </a>
          <a
            href="https://status.whynot.qa"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150 hover:text-foreground"
          >
            Status
          </a>
        </div>
      </div>
    </footer>
  )
}

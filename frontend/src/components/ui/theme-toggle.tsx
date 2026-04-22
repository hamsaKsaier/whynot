import { Moon, Sun } from "lucide-react"
import { useThemeContext } from "../ThemeProvider"
import { cn } from "../../lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggle } = useThemeContext()

  return (
    <button
      onClick={toggle}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-2 text-sm font-medium",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "transition-colors duration-150",
        className
      )}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  )
}

import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AuthShellProps {
  children: ReactNode
  className?: string
}

export function AuthShell({ children, className }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6 sm:mb-8 text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="mt-3 text-xl sm:text-2xl font-semibold text-foreground">
            WhyNot QA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered test automation
          </p>
        </div>

        <Card className={cn("border bg-card shadow-sm", className)}>
          <CardContent className="p-4 sm:p-6 md:p-8">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

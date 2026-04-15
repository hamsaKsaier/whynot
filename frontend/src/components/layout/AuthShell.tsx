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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">
            WhyNot QA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered test automation
          </p>
        </div>

        <Card className={cn("border bg-card shadow-sm", className)}>
          <CardContent className="p-6 sm:p-8">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

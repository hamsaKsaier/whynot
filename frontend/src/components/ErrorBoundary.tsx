import { Component, type ErrorInfo, type ReactNode } from "react"
import { withTranslation, type WithTranslation } from "react-i18next"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { config } from "@/config"

interface Props extends WithTranslation {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    this.setState({ error, errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = "/"
  }

  render() {
    const { t } = this.props

    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md border bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-center">
                <div className="rounded-lg bg-destructive/10 p-3">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
              </div>

              <h1 className="mb-2 text-center text-2xl font-semibold text-foreground">
                {t("error.boundary.title")}
              </h1>

              <p className="mb-6 text-center text-sm text-muted-foreground">
                {t("error.boundary.description")}
              </p>

              {config.isDev &&
                this.state.error && (
                  <div className="mb-6 rounded-md bg-muted p-4">
                    <p className="text-sm font-mono text-destructive">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                      <details className="mt-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-semibold">
                          Stack Trace
                        </summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

              <div className="flex flex-col gap-2">
                <Button onClick={this.handleReset} className="w-full">
                  <RefreshCw className="me-2 h-4 w-4" />
                  {t("error.boundary.tryAgain")}
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleReload}
                  className="w-full"
                >
                  {t("error.boundary.reload")}
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  className="w-full"
                >
                  <Home className="me-2 h-4 w-4" />
                  {t("error.boundary.goHome")}
                </Button>
              </div>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                {t("error.boundary.persist")}
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export const ErrorBoundary = withTranslation("common")(ErrorBoundaryInner)

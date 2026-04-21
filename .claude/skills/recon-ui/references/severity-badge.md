> **Single source of truth**: Before proposing any change, read [`../../../../ARCHITECTURE.md`](../../../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# Severity Badge — Component Spec

## TypeScript Prop Types

```typescript
import type { BadgeProps } from "@/components/ui/badge";

type ReconSeverity = "low" | "medium" | "high" | "critical";

interface ReconSeverityBadgeProps {
  severity: ReconSeverity;
  showLabel?: boolean;
  className?: string;
}
```

## Color Map

```typescript
const SEVERITY_CONFIG: Record<ReconSeverity, {
  labelKey: string;
  icon: LucideIcon;
  classes: string;
}> = {
  low: {
    labelKey: "recon.severity.low",
    icon: Info,
    classes:
      "bg-slate-50 text-slate-900 dark:bg-slate-900/20 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  },
  medium: {
    labelKey: "recon.severity.medium",
    icon: AlertTriangle,
    classes:
      "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  high: {
    labelKey: "recon.severity.high",
    icon: AlertOctagon,
    classes:
      "bg-orange-50 text-orange-900 dark:bg-orange-900/20 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  },
  critical: {
    labelKey: "recon.severity.critical",
    icon: ShieldAlert,
    classes:
      "bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800",
  },
};
```

## Implementation

```tsx
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Info, AlertTriangle, AlertOctagon, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReconSeverityBadge({
  severity,
  showLabel = true,
  className,
}: ReconSeverityBadgeProps) {
  const { t } = useTranslation();
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium border",
        config.classes,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {showLabel && <span>{t(config.labelKey)}</span>}
    </Badge>
  );
}
```

## Constraints

| Rule | Enforcement |
|------|-------------|
| No animation | No `animate-pulse`, `animate-bounce` anywhere on this component |
| No ring | No `ring-2 ring-offset-2` on the badge |
| Soft fill only | Always uses `bg-{color}-50 dark:bg-{color}-900/20` pattern |
| Dark mode | Full dark mode support via `dark:` variants |
| RTL | No directional icons in the default badge; if a directional icon is added, mirror with `rtl:scale-x-[-1]` |

## Scan Status Badge Variant

A companion component for scan-level status (not finding severity):

```typescript
type ReconScanStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "stuck";

interface ReconScanStatusBadgeProps {
  status: ReconScanStatus;
  className?: string;
}

const SCAN_STATUS_CONFIG: Record<ReconScanStatus, {
  labelKey: string;
  icon: LucideIcon;
  classes: string;
  animate?: boolean;
}> = {
  pending: {
    labelKey: "recon.scan.status.pending",
    icon: Clock,
    classes:
      "bg-slate-50 text-slate-900 dark:bg-slate-900/20 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  },
  running: {
    labelKey: "recon.scan.status.running",
    icon: Loader2,
    classes:
      "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    animate: true,
  },
  completed: {
    labelKey: "recon.scan.status.completed",
    icon: CheckCircle,
    classes:
      "bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  failed: {
    labelKey: "recon.scan.status.failed",
    icon: XCircle,
    classes:
      "bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  cancelled: {
    labelKey: "recon.scan.status.cancelled",
    icon: Ban,
    classes:
      "bg-slate-50 text-slate-900 dark:bg-slate-900/20 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  },
  stuck: {
    labelKey: "recon.scan.status.stuck",
    icon: AlertTriangle,
    classes:
      "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
};
```

The `running` status uses `<Loader2 className="h-3 w-3 animate-spin" />`. All other icons are static.

## Vitest Test Outline

```typescript
// ReconSeverityBadge.test.tsx
import { render, screen } from "@testing-library/react";
import { ReconSeverityBadge } from "../ReconSeverityBadge";

describe("ReconSeverityBadge", () => {
  it.each(["low", "medium", "high", "critical"] as const)(
    "renders severity '%s' with correct color classes",
    (severity) => {
      const { container } = render(
        <ReconSeverityBadge severity={severity} />,
      );
      const badge = container.firstChild as HTMLElement;

      expect(badge).toHaveClass("bg-");
      expect(badge).toHaveClass("border");
      expect(screen.getByText(new RegExp(severity, "i"))).toBeInTheDocument();
    },
  );

  it("hides label when showLabel=false", () => {
    render(<ReconSeverityBadge severity="critical" showLabel={false} />);
    expect(screen.queryByText(/critical/i)).not.toBeInTheDocument();
  });

  it("has no banned animation classes", () => {
    const { container } = render(
      <ReconSeverityBadge severity="high" />,
    );
    const badge = container.firstChild as HTMLElement;
    const classList = badge.className;

    expect(classList).not.toMatch(/animate-pulse/);
    expect(classList).not.toMatch(/animate-bounce/);
    expect(classList).not.toMatch(/ring-2/);
    expect(classList).not.toMatch(/ring-offset/);
  });

  it("matches snapshot in en", () => {
    const { container } = render(
      <ReconSeverityBadge severity="critical" />,
    );
    expect(container).toMatchSnapshot();
  });

  it("matches snapshot in ar (RTL)", () => {
    // Set document.dir = "rtl" before rendering
    document.documentElement.dir = "rtl";
    const { container } = render(
      <ReconSeverityBadge severity="critical" />,
    );
    expect(container).toMatchSnapshot();
    document.documentElement.dir = "ltr";
  });

  it("has zero axe-core critical violations", async () => {
    const { container } = render(
      <ReconSeverityBadge severity="medium" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ReconScanStatusBadge.test.tsx
describe("ReconScanStatusBadge", () => {
  it.each(["pending", "running", "completed", "failed", "cancelled", "stuck"] as const)(
    "renders status '%s' with correct color classes",
    (status) => {
      render(<ReconScanStatusBadge status={status} />);
      expect(screen.getByText(new RegExp(status, "i"))).toBeInTheDocument();
    },
  );

  it("applies animate-spin only to running status", () => {
    const { container: runningContainer } = render(
      <ReconScanStatusBadge status="running" />,
    );
    const runningIcon = runningContainer.querySelector(".animate-spin");
    expect(runningIcon).toBeInTheDocument();

    const { container: completedContainer } = render(
      <ReconScanStatusBadge status="completed" />,
    );
    const completedIcon = completedContainer.querySelector(".animate-spin");
    expect(completedIcon).not.toBeInTheDocument();
  });
});
```

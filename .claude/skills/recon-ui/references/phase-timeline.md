> **Single source of truth**: Before proposing any change, read [`../../../../ARCHITECTURE.md`](../../../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# Phase Timeline — Component Spec

## TypeScript Prop Types

```typescript
import type { LucideIcon } from "lucide-react";

type ReconPhase =
  | "fingerprinting"
  | "discovery"
  | "vuln_analysis"
  | "exploitation"
  | "reporting";

type ReconPhaseStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

interface PhaseStep {
  phase: ReconPhase;
  status: ReconPhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

interface ReconPhaseTimelineProps {
  phases: PhaseStep[];
  className?: string;
}
```

## Phase Order

```typescript
const PHASE_ORDER: ReconPhase[] = [
  "fingerprinting",
  "discovery",
  "vuln_analysis",
  "exploitation",
  "reporting",
];

const PHASE_LABEL_KEYS: Record<ReconPhase, string> = {
  fingerprinting: "recon.phases.fingerprinting",
  discovery: "recon.phases.discovery",
  vuln_analysis: "recon.phases.vuln_analysis",
  exploitation: "recon.phases.exploitation",
  reporting: "recon.phases.reporting",
};
```

## Status Icon Map

```typescript
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  SkipForward,
  Ban,
} from "lucide-react";

const STATUS_ICON: Record<ReconPhaseStatus, LucideIcon> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  skipped: SkipForward,
  cancelled: Ban,
};

const STATUS_ANIMATE: Partial<Record<ReconPhaseStatus, string>> = {
  running: "animate-spin",
};
```

## Layout

### Vertical (default, `< lg`)

```
┌─────────────────────────────────────────────┐
│ ● Fingerprinting    completed  00:32        │
│ │                                           │
│ ● Discovery         completed  01:15        │
│ │                                           │
│ ◉ Vuln Analysis     running...  02:40       │
│ │                                           │
│ ○ Exploitation      pending                │
│ │                                           │
│ ○ Reporting         pending                │
└─────────────────────────────────────────────┘
```

### Horizontal (`lg+`)

```
●───────●───────◉───────○───────○
Finger   Disc    Vuln    Expl    Rep
         overy   Analys  oitat   ortin
                 is      ion     g
```

## Implementation

```tsx
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  SkipForward,
  Ban,
} from "lucide-react";

export function ReconPhaseTimeline({
  phases,
  className,
}: ReconPhaseTimelineProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("space-y-0", className)}>
      {PHASE_ORDER.map((phaseKey, index) => {
        const step = phases.find((p) => p.phase === phaseKey);
        const status = step?.status ?? "pending";
        const Icon = STATUS_ICON[status];
        const isLast = index === PHASE_ORDER.length - 1;

        return (
          <div key={phaseKey} className="flex">
            {/* Vertical connector + icon column */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border",
                  status === "completed" &&
                    "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
                  status === "running" &&
                    "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
                  status === "failed" &&
                    "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
                  status === "pending" &&
                    "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900/20 dark:text-slate-500 dark:border-slate-800",
                  status === "skipped" &&
                    "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900/20 dark:text-slate-500 dark:border-slate-800",
                  status === "cancelled" &&
                    "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-900/20 dark:text-slate-500 dark:border-slate-800",
                )}
              >
                <Icon
                  className={cn("h-4 w-4", STATUS_ANIMATE[status])}
                  aria-label={
                    status === "running" ? t("recon.phases.status.running") : undefined
                  }
                />
              </div>
              {/* Connector line */}
              {!isLast && (
                <div className="w-px flex-1 min-h-6 border-s border-border" />
              )}
            </div>

            {/* Content column */}
            <div className={cn("flex-1 pb-4 ps-3", isLast && "pb-0")}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {t(PHASE_LABEL_KEYS[phaseKey])}
                </span>
              </div>
              {step?.startedAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDuration(step.startedAt, step.completedAt)}
                </p>
              )}
              {step?.errorMessage && (
                <p className="text-xs text-destructive mt-1">
                  {step.errorMessage}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

## Constraints

| Rule | Enforcement |
|------|-------------|
| No bounce | `animate-bounce` is banned; only `animate-spin` on `Loader2` for `running` status |
| Logical properties | Uses `ms-*`, `me-*`, `ps-*`, `pe-*`, `border-s` (for connector lines) |
| Connector lines | Use `border-border` color via `border-s border-border` |
| No hover lift | No `hover:-translate-y-*`, no `hover:shadow-md` |
| Dark mode | All status colors have `dark:` variants |
| RTL | The vertical timeline automatically flips via logical properties; the horizontal layout uses native `dir="rtl"` flex reversal |

## Responsive Behavior

```typescript
// The component renders as vertical by default.
// At lg+, optionally render a horizontal variant:
<div className="lg:hidden">
  <ReconPhaseTimelineVertical phases={phases} />
</div>
<div className="hidden lg:block">
  <ReconPhaseTimelineHorizontal phases={phases} />
</div>
```

The horizontal variant places phases in a `flex flex-row` with `border-e border-border` connectors between steps. Because the app sets `dir="rtl"` for Arabic, `flex-row` automatically reverses.

## Helper

```typescript
function formatDuration(
  startedAt: string,
  completedAt: string | null,
): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt
    ? new Date(completedAt).getTime()
    : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
```

## Vitest Test Outline

```typescript
// ReconPhaseTimeline.test.tsx
import { render, screen } from "@testing-library/react";
import { ReconPhaseTimeline } from "../ReconPhaseTimeline";

const MOCK_PHASES: PhaseStep[] = [
  { phase: "fingerprinting", status: "completed", startedAt: "2026-01-01T00:00:00Z", completedAt: "2026-01-01T00:00:32Z", errorMessage: null },
  { phase: "discovery", status: "completed", startedAt: "2026-01-01T00:00:32Z", completedAt: "2026-01-01T00:01:47Z", errorMessage: null },
  { phase: "vuln_analysis", status: "running", startedAt: "2026-01-01T00:01:47Z", completedAt: null, errorMessage: null },
  { phase: "exploitation", status: "pending", startedAt: null, completedAt: null, errorMessage: null },
  { phase: "reporting", status: "pending", startedAt: null, completedAt: null, errorMessage: null },
];

describe("ReconPhaseTimeline", () => {
  it("renders all 5 phases in order", () => {
    render(<ReconPhaseTimeline phases={MOCK_PHASES} />);
    const labels = screen.getAllByText(/recon\.phases\./);
    expect(labels).toHaveLength(5);
  });

  it("shows animate-spin only on the running phase", () => {
    const { container } = render(
      <ReconPhaseTimeline phases={MOCK_PHASES} />,
    );
    const spinningIcons = container.querySelectorAll(".animate-spin");
    expect(spinningIcons).toHaveLength(1);
  });

  it("shows error message for failed phase", () => {
    const phases: PhaseStep[] = [
      ...MOCK_PHASES,
    ];
    phases[2] = {
      ...phases[2],
      status: "failed",
      errorMessage: "Connection timeout",
      completedAt: "2026-01-01T00:02:00Z",
    };
    render(<ReconPhaseTimeline phases={phases} />);
    expect(screen.getByText("Connection timeout")).toBeInTheDocument();
  });

  it("shows duration for completed phases", () => {
    render(<ReconPhaseTimeline phases={MOCK_PHASES} />);
    expect(screen.getByText("0:32")).toBeInTheDocument();
  });

  it("has no banned CSS classes", () => {
    const { container } = render(
      <ReconPhaseTimeline phases={MOCK_PHASES} />,
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/animate-bounce/);
    expect(html).not.toMatch(/hover:-translate-y/);
    expect(html).not.toMatch(/hover:shadow-md/);
  });

  it("uses logical properties for spacing", () => {
    const { container } = render(
      <ReconPhaseTimeline phases={MOCK_PHASES} />,
    );
    const html = container.innerHTML;
    expect(html).toMatch(/ps-3|ms-/);
    expect(html).not.toMatch(/\bpl-\d\b/);
    expect(html).not.toMatch(/\bml-\d\b/);
  });

  it("renders skipped phase correctly", () => {
    const phases = MOCK_PHASES.map((p) =>
      p.phase === "exploitation" ? { ...p, status: "skipped" as const } : p,
    );
    render(<ReconPhaseTimeline phases={phases} />);
    expect(screen.getByText(/recon\.phases\.exploitation/)).toBeInTheDocument();
  });

  it("renders cancelled phase correctly", () => {
    const phases = MOCK_PHASES.map((p) =>
      p.phase === "vuln_analysis"
        ? { ...p, status: "cancelled" as const, completedAt: "2026-01-01T00:02:00Z" }
        : p,
    );
    render(<ReconPhaseTimeline phases={phases} />);
    expect(screen.getByText(/recon\.phases\.vuln_analysis/)).toBeInTheDocument();
  });

  it("matches snapshot in en", () => {
    const { container } = render(
      <ReconPhaseTimeline phases={MOCK_PHASES} />,
    );
    expect(container).toMatchSnapshot();
  });

  it("matches snapshot in ar (RTL)", () => {
    document.documentElement.dir = "rtl";
    const { container } = render(
      <ReconPhaseTimeline phases={MOCK_PHASES} />,
    );
    expect(container).toMatchSnapshot();
    document.documentElement.dir = "ltr";
  });

  it("has zero axe-core critical violations", async () => {
    const { container } = render(
      <ReconPhaseTimeline phases={MOCK_PHASES} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

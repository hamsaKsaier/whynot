import { useTranslation } from "react-i18next";
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  SkipForward,
  Ban,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ReconPhaseName,
  ReconPhaseStatus,
  ReconScanPhase,
} from "@/services/recon-api";

const PHASE_ORDER: ReconPhaseName[] = [
  "fingerprinting",
  "discovery",
  "vuln_analysis",
  "exploitation",
  "reporting",
];

const PHASE_LABEL_KEYS: Record<ReconPhaseName, string> = {
  fingerprinting: "recon.phases.fingerprinting",
  discovery: "recon.phases.discovery",
  vuln_analysis: "recon.phases.vuln_analysis",
  exploitation: "recon.phases.exploitation",
  reporting: "recon.phases.reporting",
};

const STATUS_LABEL_KEYS: Record<ReconPhaseStatus, string> = {
  pending: "recon.phases.status.pending",
  running: "recon.phases.status.running",
  completed: "recon.phases.status.completed",
  failed: "recon.phases.status.failed",
  skipped: "recon.phases.status.skipped",
  cancelled: "recon.phases.status.cancelled",
};

const STATUS_ICON: Record<
  ReconPhaseStatus,
  { icon: LucideIcon; className: string; spin?: boolean }
> = {
  pending: { icon: Clock, className: "text-muted-foreground" },
  running: { icon: Loader2, className: "text-blue-600 dark:text-blue-400", spin: true },
  completed: { icon: CheckCircle, className: "text-green-600 dark:text-green-400" },
  failed: { icon: XCircle, className: "text-destructive" },
  skipped: { icon: SkipForward, className: "text-muted-foreground" },
  cancelled: { icon: Ban, className: "text-muted-foreground" },
};

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds - mins * 60);
  return `${mins}m ${secs}s`;
}

function formatTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

interface PhaseTimelineProps {
  phases: ReconScanPhase[];
  className?: string;
}

export function PhaseTimeline({ phases, className }: PhaseTimelineProps) {
  const { t } = useTranslation("recon");

  const byName = new Map<ReconPhaseName, ReconScanPhase>();
  for (const p of phases) byName.set(p.phase, p);

  const ordered = PHASE_ORDER.map<ReconScanPhase>((name) => {
    const existing = byName.get(name);
    if (existing) return existing;
    return {
      phase: name,
      status: "pending",
      started_at: null,
      completed_at: null,
      duration_seconds: null,
      error_message: null,
    };
  });

  return (
    <ol
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-0",
        className,
      )}
      data-testid="phase-timeline"
      aria-label={t("recon.detail.phases.title")}
    >
      {ordered.map((phase, i) => {
        const cfg = STATUS_ICON[phase.status];
        const Icon = cfg.icon;
        const started = formatTimestamp(phase.started_at);
        const duration = formatDuration(phase.duration_seconds);
        const isLast = i === ordered.length - 1;
        return (
          <li
            key={phase.phase}
            data-testid={`phase-${phase.phase}`}
            data-status={phase.status}
            className="relative flex items-start gap-3 lg:flex-1 lg:flex-col lg:items-center lg:text-center"
          >
            <div
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border bg-card",
                cfg.className,
              )}
            >
              <Icon
                className={cn("h-4 w-4", cfg.spin && "animate-spin")}
                aria-label={
                  phase.status === "running"
                    ? t("recon.phases.status.running")
                    : undefined
                }
                aria-hidden={phase.status !== "running" ? true : undefined}
              />
            </div>

            <div className="flex flex-1 flex-col lg:items-center">
              <p className="text-sm font-medium text-foreground">
                {t(PHASE_LABEL_KEYS[phase.phase])}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(STATUS_LABEL_KEYS[phase.status])}
              </p>
              {started && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {started}
                </p>
              )}
              {duration && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {duration}
                </p>
              )}
              {phase.error_message && (
                <p
                  className="mt-1 text-xs text-destructive"
                  data-testid={`phase-${phase.phase}-error`}
                >
                  {phase.error_message}
                </p>
              )}
            </div>

            {!isLast && (
              <div
                className="absolute start-4 top-9 h-full w-px bg-border lg:static lg:h-px lg:w-full lg:self-center"
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Eye, Ban, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { ReconSeverityBadge } from "@/components/recon/ReconSeverityBadge";
import { ReconScanStatusBadge } from "@/components/recon/ReconScanStatusBadge";
import type {
  ReconScanListItem,
  ReconScanStatus,
  ReconSeverity,
} from "@/services/recon-api";

interface ReconScanRowProps {
  scan: ReconScanListItem;
  onCancel: (scan: ReconScanListItem) => void;
  onResume: (scan: ReconScanListItem) => void;
}

const SEVERITY_ORDER: ReconSeverity[] = ["critical", "high", "medium", "low"];

const CANCELLABLE: ReconScanStatus[] = ["pending", "running"];
const RESUMABLE: ReconScanStatus[] = ["failed", "cancelled", "stuck"];

function formatRelativeTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = Date.now();
  const diffSec = Math.round((date.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function formatCredits(credits: string): string {
  const n = Number(credits);
  if (!Number.isFinite(n)) return credits;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function ReconScanRow({ scan, onCancel, onResume }: ReconScanRowProps) {
  const { t, i18n } = useTranslation("recon");
  const navigate = useNavigate();

  const canCancel = CANCELLABLE.includes(scan.status);
  const canResume = RESUMABLE.includes(scan.status);

  const presentSeverities = SEVERITY_ORDER.filter(
    (sev) => (scan.severity_counts[sev] ?? 0) > 0,
  );

  return (
    <TableRow data-testid={`scan-row-${scan.id}`}>
      <TableCell className="text-start font-medium">
        <div className="flex flex-col">
          <span>{scan.project_name}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[240px]">
            {scan.target_url}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-start">
        <div className="flex items-center gap-2">
          <span>{scan.environment_name}</span>
          {scan.environment_tag === "production" && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wide text-red-900 bg-red-50 dark:text-red-300 dark:bg-red-900/20 px-1.5 py-0.5 rounded-md border border-red-200 dark:border-red-800"
              data-testid="production-tag"
            >
              {t("recon.list.environment.productionTag")}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-start">
        <ReconScanStatusBadge status={scan.status} />
      </TableCell>
      <TableCell className="text-start">
        {presentSeverities.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {t("recon.list.severity.none")}
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {presentSeverities.map((sev) => (
              <ReconSeverityBadge
                key={sev}
                severity={sev}
                count={scan.severity_counts[sev]}
              />
            ))}
          </div>
        )}
      </TableCell>
      <TableCell className="text-start text-sm text-muted-foreground tabular-nums">
        {formatRelativeTime(scan.started_at ?? scan.created_at, i18n.language)}
      </TableCell>
      <TableCell className="text-start text-sm text-muted-foreground tabular-nums">
        {formatDuration(scan.duration_seconds)}
      </TableCell>
      <TableCell className="text-start text-sm text-muted-foreground tabular-nums">
        {formatCredits(scan.total_cost_credits)}
      </TableCell>
      <TableCell className="text-end">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/recon/${scan.id}`)}
            aria-label={t("recon.actions.view")}
            data-testid={`action-view-${scan.id}`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only sm:ms-1.5">
              {t("recon.actions.view")}
            </span>
          </Button>
          {canCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onCancel(scan)}
              data-testid={`action-cancel-${scan.id}`}
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:ms-1.5">
                {t("recon.actions.cancel")}
              </span>
            </Button>
          )}
          {canResume && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onResume(scan)}
              data-testid={`action-resume-${scan.id}`}
            >
              <Play className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only sm:ms-1.5">
                {t("recon.actions.resume")}
              </span>
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

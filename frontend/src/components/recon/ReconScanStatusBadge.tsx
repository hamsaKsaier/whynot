import { useTranslation } from "react-i18next";
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Ban,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReconScanStatus } from "@/services/recon-api";

interface ReconScanStatusBadgeProps {
  status: ReconScanStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  ReconScanStatus,
  { labelKey: string; icon: LucideIcon; classes: string; spin?: boolean }
> = {
  pending: {
    labelKey: "recon.status.pending",
    icon: Clock,
    classes:
      "bg-slate-50 text-slate-900 dark:bg-slate-900/20 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  },
  running: {
    labelKey: "recon.status.running",
    icon: Loader2,
    classes:
      "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    spin: true,
  },
  completed: {
    labelKey: "recon.status.completed",
    icon: CheckCircle,
    classes:
      "bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  failed: {
    labelKey: "recon.status.failed",
    icon: XCircle,
    classes:
      "bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  cancelled: {
    labelKey: "recon.status.cancelled",
    icon: Ban,
    classes:
      "bg-slate-50 text-slate-900 dark:bg-slate-900/20 dark:text-slate-300 border-slate-200 dark:border-slate-800",
  },
  stuck: {
    labelKey: "recon.status.stuck",
    icon: AlertTriangle,
    classes:
      "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
};

export function ReconScanStatusBadge({ status, className }: ReconScanStatusBadgeProps) {
  const { t } = useTranslation("recon");
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium border",
        config.classes,
        className,
      )}
      data-testid={`scan-status-badge-${status}`}
    >
      <Icon
        className={cn("h-3 w-3", config.spin && "animate-spin")}
        aria-hidden="true"
      />
      <span>{t(config.labelKey)}</span>
    </Badge>
  );
}

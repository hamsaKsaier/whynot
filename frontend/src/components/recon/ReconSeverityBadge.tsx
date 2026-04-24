import { useTranslation } from "react-i18next";
import { Info, AlertTriangle, AlertOctagon, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReconSeverity } from "@/services/recon-api";

interface ReconSeverityBadgeProps {
  severity: ReconSeverity;
  count?: number;
  showLabel?: boolean;
  className?: string;
}

const SEVERITY_CONFIG: Record<
  ReconSeverity,
  { labelKey: string; icon: LucideIcon; classes: string }
> = {
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

export function ReconSeverityBadge({
  severity,
  count,
  showLabel = true,
  className,
}: ReconSeverityBadgeProps) {
  const { t } = useTranslation("recon");
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
      data-testid={`severity-badge-${severity}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {showLabel && <span>{t(config.labelKey)}</span>}
      {typeof count === "number" && <span className="tabular-nums">{count}</span>}
    </Badge>
  );
}

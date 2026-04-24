import { useCallback, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReconFinding } from "@/services/recon-api";
import { ReconSeverityBadge } from "./ReconSeverityBadge";
import { ReconPoCViewer } from "./ReconPoCViewer";

export interface ReconFindingCardProps {
  finding: ReconFinding;
  defaultExpanded?: boolean;
  onCopyPoC?: () => void;
  onViewDetails?: (findingId: string) => void;
  className?: string;
}

export function ReconFindingCard({
  finding,
  defaultExpanded = false,
  onCopyPoC,
  onViewDetails,
  className,
}: ReconFindingCardProps) {
  const { t } = useTranslation("recon");
  const [pocExpanded, setPocExpanded] = useState(defaultExpanded);
  const [descExpanded, setDescExpanded] = useState(false);
  const [endpointCopied, setEndpointCopied] = useState(false);

  const labelId = useId();
  const pocRegionId = useId();

  const vulnClassLabel = t(`recon.vulnClass.${finding.vuln_class}`);

  const handleCopyEndpoint = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(finding.normalized_endpoint);
      setEndpointCopied(true);
      toast.success(t("recon.findingCard.poc.copied"));
      window.setTimeout(() => setEndpointCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }, [finding.normalized_endpoint, t]);

  const handleTogglePoc = useCallback(() => {
    setPocExpanded((prev) => !prev);
  }, []);

  const handleToggleDesc = useCallback(() => {
    setDescExpanded((prev) => !prev);
  }, []);

  const handleViewDetails = useCallback(() => {
    onViewDetails?.(finding.id);
  }, [finding.id, onViewDetails]);

  return (
    <section
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3",
        className,
      )}
      data-testid={`recon-finding-card-${finding.id}`}
      aria-labelledby={labelId}
    >
      <span id={labelId} className="sr-only">
        {t(`recon.severity.${finding.severity}`)} — {finding.normalized_endpoint}
      </span>

      <header className="flex flex-wrap items-center gap-3">
        <ReconSeverityBadge severity={finding.severity} />
        <Badge
          variant="outline"
          className="text-xs"
          data-testid="recon-finding-vuln-class"
        >
          {vulnClassLabel}
        </Badge>
        <code
          dir="ltr"
          className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono text-foreground"
          title={finding.normalized_endpoint}
          data-testid="recon-finding-endpoint"
        >
          {finding.normalized_endpoint}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopyEndpoint}
          aria-label={t("recon.findingCard.copy.endpoint")}
          className="h-7 px-2 ms-auto"
          data-testid="recon-finding-copy-endpoint"
        >
          {endpointCopied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </Button>
      </header>

      <div className="text-sm text-foreground">
        <p
          className={cn(!descExpanded && "line-clamp-2")}
          data-testid="recon-finding-description"
        >
          {finding.description}
        </p>
        {finding.description.length > 120 ? (
          <button
            type="button"
            onClick={handleToggleDesc}
            className="mt-1 text-xs font-medium text-primary hover:underline"
            data-testid="recon-finding-desc-toggle"
          >
            {descExpanded
              ? t("recon.findingCard.showLess")
              : t("recon.findingCard.showMore")}
          </button>
        ) : null}
      </div>

      {finding.proof_of_concept ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTogglePoc}
            aria-expanded={pocExpanded}
            aria-controls={pocRegionId}
            className="h-7 gap-1 text-xs"
            data-testid="recon-finding-poc-toggle"
          >
            {pocExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {pocExpanded
                ? t("recon.findingCard.showLess")
                : t("recon.findingCard.showMore")}
            </span>
          </Button>
          {pocExpanded ? (
            <div id={pocRegionId} data-testid="recon-finding-poc-region">
              <ReconPoCViewer
                poc={finding.proof_of_concept}
                onCopy={onCopyPoC}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="flex items-start justify-between gap-3 border-t pt-3">
        <div className="min-w-0 flex-1 text-xs">
          <span className="font-medium text-foreground">
            {t("recon.findingCard.remediation")}:
          </span>{" "}
          <span
            className="text-muted-foreground line-clamp-1"
            title={finding.remediation_summary}
            data-testid="recon-finding-remediation"
          >
            {finding.remediation_summary}
          </span>
        </div>
        <button
          type="button"
          onClick={handleViewDetails}
          className="whitespace-nowrap text-xs font-medium text-primary hover:underline"
          data-testid="recon-finding-view-details"
        >
          {t("recon.findingCard.viewDetails")}
        </button>
      </footer>
    </section>
  );
}

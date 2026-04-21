import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReconSeverityBadge } from "@/components/recon/ReconSeverityBadge";
import type { ReconFinding, ReconVulnClass } from "@/services/recon-api";

const VULN_CLASS_LABEL_KEYS: Record<ReconVulnClass, string> = {
  injection: "recon.vulnClass.injection",
  xss: "recon.vulnClass.xss",
  ssrf: "recon.vulnClass.ssrf",
  auth: "recon.vulnClass.auth",
  authz: "recon.vulnClass.authz",
};

interface FindingCardProps {
  finding: ReconFinding;
  className?: string;
}

export function FindingCard({ finding, className }: FindingCardProps) {
  const { t } = useTranslation("recon");
  const [expanded, setExpanded] = useState(false);

  const copyEndpoint = useCallback(() => {
    navigator.clipboard
      ?.writeText(finding.normalized_endpoint)
      .catch(() => undefined);
  }, [finding.normalized_endpoint]);

  const copyPoc = useCallback(() => {
    if (!finding.proof_of_concept) return;
    navigator.clipboard
      ?.writeText(finding.proof_of_concept.content)
      .catch(() => undefined);
  }, [finding.proof_of_concept]);

  return (
    <Card
      className={cn("rounded-lg border bg-card shadow-sm", className)}
      data-testid={`finding-card-${finding.id}`}
      data-severity={finding.severity}
      data-vuln-class={finding.vuln_class}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <ReconSeverityBadge severity={finding.severity} />
          <Badge variant="outline" className="text-xs font-medium">
            {t(VULN_CLASS_LABEL_KEYS[finding.vuln_class])}
          </Badge>
          <code
            dir="ltr"
            className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs text-foreground"
          >
            {finding.normalized_endpoint}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyEndpoint}
            aria-label={t("recon.findingCard.copy.endpoint")}
            data-testid={`finding-copy-endpoint-${finding.id}`}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground">{finding.description}</p>

        {finding.proof_of_concept && (
          <div className="rounded-md border">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors duration-150"
              aria-expanded={expanded}
              data-testid={`finding-poc-toggle-${finding.id}`}
            >
              <span>
                {expanded
                  ? t("recon.findingCard.showLess")
                  : t("recon.findingCard.showMore")}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-150",
                  expanded && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            {expanded && (
              <div className="relative border-t bg-muted/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyPoc}
                  aria-label={t("recon.findingCard.copy.poc")}
                  className="absolute end-2 top-2"
                  data-testid={`finding-copy-poc-${finding.id}`}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </Button>
                <pre
                  dir="ltr"
                  className="overflow-x-auto whitespace-pre-wrap break-words p-3 pe-12 font-mono text-xs text-foreground"
                >
                  {finding.proof_of_concept.content}
                </pre>
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("recon.findingCard.remediation")}:
          </span>{" "}
          {finding.remediation_summary}
        </p>
      </CardContent>
    </Card>
  );
}

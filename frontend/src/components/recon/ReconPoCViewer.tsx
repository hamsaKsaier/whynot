import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReconProofOfConcept } from "@/services/recon-api";

interface ReconPoCViewerProps {
  poc: ReconProofOfConcept;
  onCopy?: () => void;
  className?: string;
}

function getCopyPayload(poc: ReconProofOfConcept): string {
  if (poc.kind === "http") {
    const parts: string[] = [];
    if (poc.request) parts.push(poc.request);
    if (poc.response) parts.push(poc.response);
    return parts.join("\n\n") || poc.content;
  }
  return poc.content;
}

export function ReconPoCViewer({ poc, onCopy, className }: ReconPoCViewerProps) {
  const { t } = useTranslation("recon");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const payload = getCopyPayload(poc);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success(t("recon.findingCard.poc.copied"));
      onCopy?.();
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; fail silently
    }
  }, [poc, onCopy, t]);

  return (
    <div
      className={cn(
        "relative rounded-md border bg-muted text-muted-foreground",
        className,
      )}
      data-testid={`recon-poc-viewer-${poc.kind}`}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {poc.kind === "code" && poc.language
            ? poc.language
            : poc.kind === "http"
              ? "HTTP"
              : poc.kind === "script"
                ? "shell"
                : poc.language || poc.kind}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          aria-label={t("recon.findingCard.copy.poc")}
          className="h-7 gap-1 text-xs"
          data-testid="recon-poc-copy-button"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{t("recon.findingCard.copy.poc")}</span>
        </Button>
      </div>
      {poc.kind === "http" ? (
        <div className="divide-y">
          {poc.request ? (
            <pre
              dir="ltr"
              className="overflow-x-auto whitespace-pre-wrap break-words p-3 text-xs font-mono text-foreground"
              data-testid="recon-poc-http-request"
            >
              {poc.request}
            </pre>
          ) : null}
          {poc.response ? (
            <pre
              dir="ltr"
              className="overflow-x-auto whitespace-pre-wrap break-words p-3 text-xs font-mono text-foreground"
              data-testid="recon-poc-http-response"
            >
              {poc.response}
            </pre>
          ) : null}
          {!poc.request && !poc.response ? (
            <pre
              dir="ltr"
              className="overflow-x-auto whitespace-pre-wrap break-words p-3 text-xs font-mono text-foreground"
            >
              {poc.content}
            </pre>
          ) : null}
        </div>
      ) : (
        <pre
          dir="ltr"
          className={cn(
            "overflow-x-auto whitespace-pre-wrap break-words p-3 text-xs font-mono text-foreground",
            poc.kind === "script" && "bg-slate-950 text-slate-100 rounded-b-md",
          )}
          data-testid={`recon-poc-${poc.kind}-content`}
        >
          {poc.content}
        </pre>
      )}
    </div>
  );
}

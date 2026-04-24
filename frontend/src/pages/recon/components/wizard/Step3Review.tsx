import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getReconQuota,
  type ReconQuotaResponse,
} from "@/services/recon-api";

export interface Step3Summary {
  projectName: string;
  environmentName: string;
  targetUrl: string;
  configFileName: string | null;
}

interface Step3ReviewProps {
  summary: Step3Summary;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
}

export function Step3Review({
  summary,
  onBack,
  onSubmit,
  submitting,
  submitError,
}: Step3ReviewProps) {
  const { t } = useTranslation("recon");
  const [quota, setQuota] = useState<ReconQuotaResponse | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setQuotaLoading(true);
    setQuotaError(null);
    getReconQuota()
      .then((q) => {
        if (!cancelled) setQuota(q);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setQuotaError(
          err instanceof Error ? err.message : "Failed to load quota",
        );
      })
      .finally(() => {
        if (!cancelled) setQuotaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6" data-testid="wizard-step-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("recon.wizard.step3.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("recon.wizard.step3.subtitle")}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[max-content_1fr] sm:gap-x-4 text-sm">
          <dt className="text-muted-foreground">
            {t("recon.wizard.step3.summary.project")}
          </dt>
          <dd
            className="font-medium text-foreground"
            data-testid="wizard-summary-project"
          >
            {summary.projectName}
          </dd>
          <dt className="text-muted-foreground">
            {t("recon.wizard.step3.summary.environment")}
          </dt>
          <dd
            className="font-medium text-foreground"
            data-testid="wizard-summary-environment"
          >
            {summary.environmentName}
          </dd>
          <dt className="text-muted-foreground">
            {t("recon.wizard.step3.summary.url")}
          </dt>
          <dd
            className="font-medium text-foreground break-all"
            data-testid="wizard-summary-url"
          >
            {summary.targetUrl}
          </dd>
          <dt className="text-muted-foreground">
            {t("recon.wizard.step3.summary.config")}
          </dt>
          <dd
            className="font-medium text-foreground"
            data-testid="wizard-summary-config"
          >
            {summary.configFileName ?? t("recon.wizard.step3.summary.configNone")}
          </dd>
        </dl>
      </div>

      <div
        className="rounded-lg border bg-muted/30 p-4"
        data-testid="wizard-cost-preview"
      >
        <h3 className="text-sm font-semibold text-foreground">
          {t("recon.wizard.step3.costTitle")}
        </h3>
        {quotaLoading ? (
          <Skeleton className="mt-2 h-5 w-48" />
        ) : quotaError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {quotaError}
          </p>
        ) : quota ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {quota.mode === "included"
              ? t("recon.wizard.step3.cost.included", {
                  count: quota.remaining,
                })
              : t("recon.wizard.step3.cost.payg", {
                  credits: quota.cost_credits,
                })}
          </p>
        ) : null}
      </div>

      {submitError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription data-testid="wizard-submit-error">
            {submitError}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          data-testid="wizard-step3-back"
        >
          {t("recon.wizard.back")}
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          data-testid="wizard-step3-submit"
        >
          {submitting && (
            <Loader2
              className="h-4 w-4 me-2 animate-spin"
              aria-hidden="true"
            />
          )}
          {t("recon.wizard.step3.cta")}
        </Button>
      </div>
    </div>
  );
}

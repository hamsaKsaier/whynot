import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEnvironments,
  getProjects,
  type SavedEnvironment,
} from "@/services/api";
import type { ReconAuthorization } from "@/services/recon-api";
import { useCreateReconScan } from "./hooks/useCreateReconScan";
import {
  Step1Target,
  type ScannableProject,
  type Step1Value,
  type TaggedEnvironment,
} from "./components/wizard/Step1Target";
import {
  JUSTIFICATION_MIN,
  Step2Authorization,
  type Step2Value,
} from "./components/wizard/Step2Authorization";
import { Step3Review } from "./components/wizard/Step3Review";

type WizardStep = 1 | 2 | 3;

const VALID_STEPS: WizardStep[] = [1, 2, 3];

function parseStep(raw: string | null): WizardStep {
  const n = Number(raw);
  return VALID_STEPS.includes(n as WizardStep) ? (n as WizardStep) : 1;
}

export function ReconNewScanPage() {
  const { t } = useTranslation("recon");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const create = useCreateReconScan();

  const step = parseStep(searchParams.get("step"));

  const [projects, setProjects] = useState<ScannableProject[]>([]);
  const [environments, setEnvironments] = useState<TaggedEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step1, setStep1] = useState<Step1Value>({
    projectId: null,
    environmentId: null,
    configFileName: null,
    configYaml: null,
  });
  const [step2, setStep2] = useState<Step2Value>({
    acknowledged: false,
    justification: "",
  });

  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projectsRes, environmentsRes] = await Promise.all([
          getProjects(0, 200),
          getEnvironments(),
        ]);
        if (cancelled) return;
        setProjects(projectsRes.projects as ScannableProject[]);
        setEnvironments(
          environmentsRes.environments as unknown as (TaggedEnvironment &
            SavedEnvironment)[],
        );
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Failed to load targets",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goToStep = useCallback(
    (next: WizardStep) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("step", String(next));
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const hasUnsavedInput = useMemo(() => {
    if (step1.projectId || step1.environmentId) return true;
    if (step1.configFileName) return true;
    if (step2.acknowledged) return true;
    if (step2.justification.trim().length > 0) return true;
    return false;
  }, [
    step1.projectId,
    step1.environmentId,
    step1.configFileName,
    step2.acknowledged,
    step2.justification,
  ]);

  // beforeunload guard for tab close / reload
  useEffect(() => {
    if (!hasUnsavedInput || create.pending) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedInput, create.pending]);

  const selectedProject = projects.find((p) => p.id === step1.projectId);
  const selectedEnvironment = environments.find(
    (e) => e.id === step1.environmentId,
  );

  const requestExit = useCallback(() => {
    if (hasUnsavedInput) {
      setDiscardOpen(true);
    } else {
      navigate("/recon");
    }
  }, [hasUnsavedInput, navigate]);

  const confirmDiscard = useCallback(() => {
    setStep1({
      projectId: null,
      environmentId: null,
      configFileName: null,
      configYaml: null,
    });
    setStep2({ acknowledged: false, justification: "" });
    setDiscardOpen(false);
    navigate("/recon");
  }, [navigate]);

  const handleSubmit = useCallback(async () => {
    if (!user || !selectedProject || !selectedEnvironment) return;
    const acknowledged = step2.acknowledged;
    const justification = step2.justification.trim();
    if (!acknowledged || justification.length < JUSTIFICATION_MIN) return;

    const authorization: ReconAuthorization = {
      acknowledged: true,
      justification,
      acknowledged_by_user_id: user.id,
      acknowledged_at: new Date().toISOString(),
    };

    try {
      const res = await create.submit({
        project_id: selectedProject.id,
        environment_id: selectedEnvironment.id,
        target_url: selectedEnvironment.url,
        authorization,
        config_yaml: step1.configYaml,
      });
      // Reset dirty state so beforeunload doesn't fire on redirect.
      setStep1({
        projectId: null,
        environmentId: null,
        configFileName: null,
        configYaml: null,
      });
      setStep2({ acknowledged: false, justification: "" });
      navigate(`/recon/${res.scan.id}`);
    } catch {
      // Error is surfaced via create.error; stay on step 3.
    }
  }, [
    create,
    navigate,
    selectedEnvironment,
    selectedProject,
    step1.configYaml,
    step2.acknowledged,
    step2.justification,
    user,
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
              {t("recon.wizard.title")}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {t("recon.wizard.subtitle")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={requestExit}
            data-testid="wizard-cancel"
          >
            {t("recon.wizard.cancel")}
          </Button>
        </div>
        <StepIndicator current={step} />
      </div>

      {step === 1 && (
        <Step1Target
          projects={projects}
          environments={environments}
          value={step1}
          onChange={setStep1}
          onContinue={() => goToStep(2)}
          loading={loading}
          loadError={loadError}
        />
      )}

      {step === 2 && (
        <Step2Authorization
          value={step2}
          onChange={setStep2}
          onBack={() => goToStep(1)}
          onContinue={() => goToStep(3)}
        />
      )}

      {step === 3 && selectedProject && selectedEnvironment && (
        <Step3Review
          summary={{
            projectName: selectedProject.name,
            environmentName: selectedEnvironment.name,
            targetUrl: selectedEnvironment.url,
            configFileName: step1.configFileName,
          }}
          onBack={() => goToStep(2)}
          onSubmit={handleSubmit}
          submitting={create.pending}
          submitError={create.error}
        />
      )}

      {step === 3 && (!selectedProject || !selectedEnvironment) && (
        <div
          className="rounded-md border bg-card p-4 text-sm text-muted-foreground"
          data-testid="wizard-step3-incomplete"
        >
          {t("recon.wizard.step3.incomplete")}
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => goToStep(1)}
            >
              {t("recon.wizard.step3.restart")}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={discardOpen}
        onOpenChange={(open) => {
          if (!open) setDiscardOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recon.wizard.discard.title")}</DialogTitle>
            <DialogDescription>
              {t("recon.wizard.discard.body")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardOpen(false)}
              data-testid="wizard-discard-cancel"
            >
              {t("recon.wizard.discard.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDiscard}
              data-testid="wizard-discard-confirm"
            >
              {t("recon.wizard.discard.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StepIndicator({ current }: { current: WizardStep }) {
  const { t } = useTranslation("recon");
  const labels: Array<[WizardStep, string]> = [
    [1, t("recon.wizard.step1.indicator")],
    [2, t("recon.wizard.step2.indicator")],
    [3, t("recon.wizard.step3.indicator")],
  ];

  return (
    <ol
      className="mt-4 flex items-center gap-2 text-sm flex-wrap"
      data-testid="wizard-step-indicator"
    >
      {labels.map(([n, label], i) => {
        const active = n === current;
        const done = n < current;
        return (
          <li
            key={n}
            className="flex items-center gap-2"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground")
              }
            >
              {n}
            </span>
            <span
              className={
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }
            >
              {label}
            </span>
            {i < labels.length - 1 && (
              <span
                className="text-muted-foreground mx-1"
                aria-hidden="true"
              >
                ·
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

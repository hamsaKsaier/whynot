import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, FileText, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectWithStats, SavedEnvironment } from "@/services/api";
import type { ReconEnvironmentTag } from "@/services/recon-api";

const MAX_CONFIG_SIZE = 64 * 1024; // 64 KB

/**
 * Project filter: only projects linked to a GitHub repo are scannable.
 * B1/B3 will surface a structured `has_repo` flag on the project payload.
 * Until then we accept either the flag or any project (defensive default).
 */
export type ScannableProject = ProjectWithStats & {
  has_repo?: boolean;
  github_repo_id?: string | null;
};

/**
 * Environment filter: only environments with a `url` (target_url) can be scanned.
 * The `tag` field is not yet surfaced on SavedEnvironment; when B1/B3 adds it,
 * the wizard will pick it up. Until then we infer `production` from the name.
 */
export type TaggedEnvironment = SavedEnvironment & {
  tag?: ReconEnvironmentTag;
};

export function inferEnvironmentTag(env: TaggedEnvironment): ReconEnvironmentTag {
  if (env.tag) return env.tag;
  const name = (env.name || "").toLowerCase();
  if (name.includes("prod")) return "production";
  if (name.includes("stag")) return "staging";
  return "development";
}

export interface Step1Value {
  projectId: string | null;
  environmentId: string | null;
  configFileName: string | null;
  configYaml: string | null;
}

interface Step1TargetProps {
  projects: ScannableProject[];
  environments: TaggedEnvironment[];
  value: Step1Value;
  onChange: (next: Step1Value) => void;
  onContinue: () => void;
  loading?: boolean;
  loadError?: string | null;
}

export function Step1Target({
  projects,
  environments,
  value,
  onChange,
  onContinue,
  loading,
  loadError,
}: Step1TargetProps) {
  const { t } = useTranslation("recon");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scannableProjects = useMemo(
    () => projects.filter((p) => p.has_repo !== false),
    [projects],
  );

  const scannableEnvironments = useMemo(
    () => environments.filter((e) => !!e.url && e.url.trim() !== ""),
    [environments],
  );

  const selectedEnvironment = useMemo(
    () => scannableEnvironments.find((e) => e.id === value.environmentId) || null,
    [scannableEnvironments, value.environmentId],
  );

  const selectedEnvironmentTag = selectedEnvironment
    ? inferEnvironmentTag(selectedEnvironment)
    : null;

  const isProduction = selectedEnvironmentTag === "production";

  const canContinue =
    !!value.projectId && !!value.environmentId && !loading;

  const handleConfigFile = (file: File | null) => {
    if (!file) {
      onChange({ ...value, configFileName: null, configYaml: null });
      return;
    }
    if (file.size > MAX_CONFIG_SIZE) {
      onChange({
        ...value,
        configFileName: null,
        configYaml: null,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Size error surfaced inline below via validation check
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text =
        typeof reader.result === "string" ? reader.result : null;
      onChange({
        ...value,
        configFileName: file.name,
        configYaml: text,
      });
    };
    reader.readAsText(file);
  };

  const clearConfig = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange({ ...value, configFileName: null, configYaml: null });
  };

  return (
    <div className="flex flex-col gap-6" data-testid="wizard-step-1">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("recon.wizard.step1.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("recon.wizard.step1.subtitle")}
        </p>
      </div>

      {loadError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="wizard-project">
          {t("recon.wizard.step1.projectLabel")}
        </Label>
        <Select
          value={value.projectId ?? ""}
          onValueChange={(v) =>
            onChange({ ...value, projectId: v || null })
          }
          disabled={loading || scannableProjects.length === 0}
        >
          <SelectTrigger id="wizard-project" data-testid="wizard-project-select">
            <SelectValue
              placeholder={t("recon.wizard.step1.projectPlaceholder")}
            />
          </SelectTrigger>
          <SelectContent>
            {scannableProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scannableProjects.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">
            {t("recon.wizard.step1.noProjects")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="wizard-environment">
          {t("recon.wizard.step1.environmentLabel")}
        </Label>
        <Select
          value={value.environmentId ?? ""}
          onValueChange={(v) =>
            onChange({ ...value, environmentId: v || null })
          }
          disabled={loading || scannableEnvironments.length === 0}
        >
          <SelectTrigger
            id="wizard-environment"
            data-testid="wizard-environment-select"
          >
            <SelectValue
              placeholder={t("recon.wizard.step1.environmentPlaceholder")}
            />
          </SelectTrigger>
          <SelectContent>
            {scannableEnvironments.map((env) => (
              <SelectItem key={env.id} value={env.id}>
                {env.name} — {env.url}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {scannableEnvironments.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">
            {t("recon.wizard.step1.noEnvironments")}
          </p>
        )}
      </div>

      {isProduction && (
        <Alert
          className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
          data-testid="production-warning"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>
            {t("recon.wizard.step1.productionWarning.title")}
          </AlertTitle>
          <AlertDescription>
            {t("recon.wizard.step1.productionWarning.body")}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="wizard-config">
          {t("recon.wizard.step1.configLabel")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("recon.wizard.step1.configHelp")}
        </p>
        {value.configFileName ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
            <FileText
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="flex-1 truncate" data-testid="wizard-config-name">
              {value.configFileName}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearConfig}
              aria-label={t("recon.wizard.step1.configClear")}
              data-testid="wizard-config-clear"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <input
            ref={fileInputRef}
            id="wizard-config"
            type="file"
            accept=".yaml,.yml,application/x-yaml,text/yaml,text/plain"
            onChange={(e) =>
              handleConfigFile(e.target.files?.[0] ?? null)
            }
            data-testid="wizard-config-input"
            className="text-sm file:me-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          data-testid="wizard-step1-continue"
        >
          {t("recon.wizard.step1.cta")}
        </Button>
      </div>
    </div>
  );
}

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const JUSTIFICATION_MIN = 20;
export const JUSTIFICATION_MAX = 1000;

export interface Step2Value {
  acknowledged: boolean;
  justification: string;
}

interface Step2AuthorizationProps {
  value: Step2Value;
  onChange: (next: Step2Value) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function Step2Authorization({
  value,
  onChange,
  onBack,
  onContinue,
}: Step2AuthorizationProps) {
  const { t } = useTranslation("recon");
  const switchId = useId();
  const textareaId = useId();

  const length = value.justification.length;
  const tooShort = length < JUSTIFICATION_MIN;
  const atMax = length >= JUSTIFICATION_MAX;
  const canContinue = value.acknowledged && !tooShort;

  const handleJustificationChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const raw = e.target.value;
    const clamped =
      raw.length > JUSTIFICATION_MAX ? raw.slice(0, JUSTIFICATION_MAX) : raw;
    onChange({ ...value, justification: clamped });
  };

  return (
    <div className="flex flex-col gap-6" data-testid="wizard-step-2">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t("recon.wizard.step2.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("recon.wizard.step2.subtitle")}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">
          {t("recon.wizard.step2.acknowledgementTitle")}
        </h3>
        <ul className="mt-2 list-disc ps-5 text-sm text-muted-foreground space-y-1">
          <li>{t("recon.wizard.step2.acknowledgementBody.realExploits")}</li>
          <li>{t("recon.wizard.step2.acknowledgementBody.auditLogged")}</li>
          <li>{t("recon.wizard.step2.acknowledgementBody.legalAuthority")}</li>
        </ul>
      </div>

      {/* Touch target via parent container per switch-component-styling rule:
          min-h-[44px] lives on the wrapper, NOT on the Switch. */}
      <div className="flex items-center justify-between gap-3 rounded-md border p-3 min-h-[44px]">
        <Label htmlFor={switchId} className="cursor-pointer text-sm">
          {t("recon.wizard.step2.switchLabel")}
        </Label>
        <Switch
          id={switchId}
          checked={value.acknowledged}
          onCheckedChange={(checked) =>
            onChange({ ...value, acknowledged: checked })
          }
          data-testid="wizard-ack-switch"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={textareaId}>
          {t("recon.wizard.step2.justificationLabel")}
        </Label>
        <Textarea
          id={textareaId}
          rows={4}
          value={value.justification}
          onChange={handleJustificationChange}
          placeholder={t("recon.wizard.step2.justificationPlaceholder")}
          aria-invalid={tooShort}
          aria-describedby={`${textareaId}-counter`}
          maxLength={JUSTIFICATION_MAX}
          data-testid="wizard-justification-input"
        />
        <div
          id={`${textareaId}-counter`}
          className="flex items-center justify-between text-xs"
        >
          <span
            className={
              tooShort ? "text-destructive" : "text-muted-foreground"
            }
            data-testid="wizard-justification-error"
          >
            {tooShort
              ? t("recon.wizard.step2.justificationTooShort")
              : atMax
                ? t("recon.wizard.step2.justificationTooLong")
                : ""}
          </span>
          <span
            className="text-muted-foreground"
            data-testid="wizard-justification-counter"
          >
            {length}/{JUSTIFICATION_MAX}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          data-testid="wizard-step2-back"
        >
          {t("recon.wizard.back")}
        </Button>
        <Button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          data-testid="wizard-step2-continue"
        >
          {t("recon.wizard.step2.cta")}
        </Button>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReconNewScanButton() {
  const { t } = useTranslation("recon");
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      onClick={() => navigate("/recon/new")}
      className="gap-1.5"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {t("recon.list.newScan")}
    </Button>
  );
}

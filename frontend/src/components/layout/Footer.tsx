import { useTranslation } from "react-i18next"
import { Separator } from "@/components/ui/separator"
import { config } from "@/config"

export function Footer() {
  const { t } = useTranslation("common")

  return (
    <footer className="border-t bg-background">
      <Separator />
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground sm:px-6">
        <span>{t("common.footer.appVersion", { version: config.appVersion })}</span>
        <div className="flex items-center gap-4">
          <a
            href="https://docs.whynot.qa"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150 hover:text-foreground"
          >
            {t("common.footer.docs")}
          </a>
          <a
            href="https://status.whynot.qa"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150 hover:text-foreground"
          >
            {t("common.footer.status")}
          </a>
        </div>
      </div>
    </footer>
  )
}

import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcutKeys = [
  { key: "Space", descriptionKey: "common.keyboardShortcuts.pauseResume" },
  { key: "R", descriptionKey: "common.keyboardShortcuts.rerunTest" },
  { key: "Escape", descriptionKey: "common.keyboardShortcuts.closeDialog" },
  { key: "?", descriptionKey: "common.keyboardShortcuts.showShortcuts" },
  { key: "F", descriptionKey: "common.keyboardShortcuts.toggleFullscreen" },
] as const;

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const { t } = useTranslation("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("common.keyboardShortcuts.title")}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("common.keyboardShortcuts.key")}</TableHead>
              <TableHead className="text-start">{t("common.keyboardShortcuts.action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shortcutKeys.map((shortcut) => (
              <TableRow key={shortcut.key}>
                <TableCell>
                  <kbd className="bg-muted border border-border rounded-md px-1.5 py-0.5 text-xs font-mono">
                    {shortcut.key}
                  </kbd>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t(shortcut.descriptionKey)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

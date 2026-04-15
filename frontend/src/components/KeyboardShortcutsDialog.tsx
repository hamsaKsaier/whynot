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

const shortcuts = [
  { key: "Space", description: "Pause / Resume execution" },
  { key: "R", description: "Rerun test" },
  { key: "Escape", description: "Close detail dialog" },
  { key: "?", description: "Show this dialog" },
  { key: "F", description: "Toggle fullscreen preview" },
] as const;

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">Key</TableHead>
              <TableHead className="text-start">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shortcuts.map((shortcut) => (
              <TableRow key={shortcut.key}>
                <TableCell>
                  <kbd className="bg-muted border border-border rounded-md px-1.5 py-0.5 text-xs font-mono">
                    {shortcut.key}
                  </kbd>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {shortcut.description}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

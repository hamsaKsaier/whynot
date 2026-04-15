import { Download } from 'lucide-react'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

interface ExportMenuProps {
  onExportCSV?: () => void
  onExportJSON?: () => void
  disabled?: boolean
}

export function ExportMenu({ onExportCSV, onExportJSON, disabled }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 me-1.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onExportCSV && <DropdownMenuItem onClick={onExportCSV}>Export as CSV</DropdownMenuItem>}
        {onExportJSON && <DropdownMenuItem onClick={onExportJSON}>Export as JSON</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

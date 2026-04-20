import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ReportsToolbarOption {
  value: string;
  label: string;
}

export interface ReportsToolbarSelect {
  value: string;
  placeholder: string;
  options: ReportsToolbarOption[];
  onChange: (v: string) => void;
  ariaLabel: string;
}

export interface ReportsToolbarProps {
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (v: string) => void;
  filter?: ReportsToolbarSelect;
  sort?: ReportsToolbarSelect;
}

export const ReportsToolbar: React.FC<ReportsToolbarProps> = ({
  searchValue,
  searchPlaceholder,
  onSearchChange,
  filter,
  sort,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2 mb-3">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 ps-8"
        />
      </div>
      {filter && (
        <Select value={filter.value} onValueChange={filter.onChange}>
          <SelectTrigger
            className="h-9 w-full sm:w-[160px]"
            aria-label={filter.ariaLabel}
          >
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {sort && (
        <Select value={sort.value} onValueChange={sort.onChange}>
          <SelectTrigger
            className="h-9 w-full sm:w-[160px]"
            aria-label={sort.ariaLabel}
          >
            <SelectValue placeholder={sort.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {sort.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

import React from 'react';
import { FiX } from 'react-icons/fi';
import { Button } from './Button';
import { Select } from './Select';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'date' | 'text';
  options?: FilterOption[];
  value?: string;
  onChange: (value: string) => void;
}

interface FilterPanelProps {
  filters: FilterConfig[];
  activeFilters: Array<{ key: string; label: string; value: string }>;
  onFilterRemove: (key: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  activeFilters,
  onFilterRemove,
  onClearAll,
  isOpen,
  onClose,
  className = '',
}) => {
  if (!isOpen) return null;

  return (
    <div className={`bg-card border border-border rounded-lg shadow-sm p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close filters"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        {filters.map((filter) => (
          <div key={filter.key}>
            <label className="block text-sm font-medium text-foreground mb-1">
              {filter.label}
            </label>
            {filter.type === 'select' && filter.options && (
              <Select
                options={[{ value: '', label: 'All' }, ...filter.options]}
                value={filter.value || ''}
                onChange={(value) => filter.onChange(value)}
                className="w-full"
              />
            )}
            {filter.type === 'text' && (
              <input
                type="text"
                value={filter.value || ''}
                onChange={(e) => filter.onChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={`Filter by ${filter.label.toLowerCase()}`}
              />
            )}
            {filter.type === 'date' && (
              <input
                type="date"
                value={filter.value || ''}
                onChange={(e) => filter.onChange(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>
        ))}
      </div>

      {activeFilters.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Active Filters</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClearAll}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <span
                key={filter.key}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary-900/30 text-primary-300 text-xs rounded-md"
              >
                <span className="font-medium">{filter.label}:</span>
                <span>{filter.value}</span>
                <button
                  onClick={() => onFilterRemove(filter.key)}
                  className="ms-1 hover:text-primary-900"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <FiX className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

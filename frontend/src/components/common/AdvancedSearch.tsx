import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FiSearch, FiX, FiFilter } from 'react-icons/fi';
import { Input } from './Input';
import { Button } from './Button';
import { debounce } from '../../utils/debounce';

interface FilterChip {
  key: string;
  label: string;
  value: string;
}

interface AdvancedSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filters?: FilterChip[];
  onFilterRemove?: (key: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  filters = [],
  onFilterRemove,
  onClearAll,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced onChange
  const debouncedOnChange = useMemo(
    () => debounce((val: string) => onChange(val), 300),
    [onChange]
  );

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  // Keyboard shortcut: Cmd/Ctrl + K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hasActiveFilters = filters.length > 0;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 h-5 w-5" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="pl-10 pr-10"
        />
        {localValue.length > 0 && (
          <button
            onClick={() => {
              setLocalValue('');
              onChange('');
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-400"
            aria-label="Clear search"
          >
            <FiX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {filters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-900/30 text-primary-300 text-xs rounded-md"
            >
              <span className="font-medium">{filter.label}:</span>
              <span>{filter.value}</span>
              {onFilterRemove && (
                <button
                  onClick={() => onFilterRemove(filter.key)}
                  className="ml-1 hover:text-primary-900"
                  aria-label={`Remove ${filter.label} filter`}
                >
                  <FiX className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {onClearAll && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onClearAll}
              className="text-xs"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Keyboard shortcut hint */}
      {isFocused && (
        <div className="absolute right-3 top-full mt-1 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-1 shadow-sm">
          Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-xs">⌘K</kbd> to focus
        </div>
      )}
    </div>
  );
};

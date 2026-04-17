import React from 'react';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiX } from 'react-icons/fi';
import { Input } from './Input';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  debounceMs = 300,
}) => {
  const { t } = useTranslation('common');
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [localValue, onChange, debounceMs]);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="absolute start-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
        <FiSearch className="h-5 w-5" />
      </div>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder ?? t('common.actions.search')}
        className={`w-full ps-10 pe-10 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${className}`}
        aria-label={t('common.aria.search')}
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute end-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={t('common.aria.clearSearch')}
        >
          <FiX className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

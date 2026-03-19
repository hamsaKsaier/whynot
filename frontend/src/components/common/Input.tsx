import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showCharCount?: boolean;
  validator?: (value: string) => string | null;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error: externalError,
  className = '',
  id,
  value,
  onChange,
  onBlur,
  maxLength,
  showCharCount = false,
  validateOnChange = false,
  validateOnBlur = true,
  validator,
  type = 'text',
  ...props
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const errorId = externalError ? `${inputId}-error` : undefined;

  const [internalError, setInternalError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [hasBlurred, setHasBlurred] = useState(false);

  const error = externalError || internalError;
  const shouldValidate = (validateOnChange && value) || (validateOnBlur && hasBlurred);

  useEffect(() => {
    if (shouldValidate && validator && value) {
      const validationError = validator(String(value));
      setInternalError(validationError);
      setIsValid(validationError === null);
    } else if (shouldValidate && type === 'url' && value) {
      // URL validation
      try {
        new URL(String(value));
        setInternalError(null);
        setIsValid(true);
      } catch {
        setInternalError('Please enter a valid URL');
        setIsValid(false);
      }
    } else if (!value) {
      setInternalError(null);
      setIsValid(null);
    }
  }, [value, shouldValidate, validator, type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (validateOnChange) {
      setInternalError(null);
      setIsValid(null);
    }
    onChange?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setHasBlurred(true);
    onBlur?.(e);
  };

  const getValidationState = () => {
    if (error) return 'error';
    if (isValid && shouldValidate) return 'success';
    return 'default';
  };

  const validationState = getValidationState();

  const stateClasses = {
    error: 'border-red-500 focus:ring-red-500 focus:border-red-500',
    success: 'border-green-500 focus:ring-green-500 focus:border-green-500',
    default: 'border-slate-600 focus:ring-primary-500 focus:border-primary-500',
  };

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-200 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={`input-field ${stateClasses[validationState]} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={errorId}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          maxLength={maxLength}
          {...props}
        />
        {validationState === 'success' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <FiCheckCircle className="h-5 w-5 text-green-500" />
          </div>
        )}
        {validationState === 'error' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <FiXCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-1">
        {error && (
          <p id={errorId} className="text-sm text-red-600 flex items-center gap-1" role="alert">
            <FiAlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
        {maxLength && showCharCount && (
          <span className={`text-xs ml-auto ${error ? 'text-red-600' : 'text-slate-400'}`}>
            {(value?.toString().length || 0)} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
});
Input.displayName = 'Input';






























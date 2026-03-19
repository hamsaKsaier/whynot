import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiAlertCircle } from 'react-icons/fi';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showCharCount?: boolean;
  validator?: (value: string) => string | null;
}

export const Textarea: React.FC<TextareaProps> = ({
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
  ...props
}) => {
  const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const errorId = externalError ? `${textareaId}-error` : undefined;
  
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
    } else if (!value) {
      setInternalError(null);
      setIsValid(null);
    }
  }, [value, shouldValidate, validator]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (validateOnChange) {
      setInternalError(null);
      setIsValid(null);
    }
    onChange?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
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
        <label htmlFor={textareaId} className="block text-sm font-medium text-slate-200 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          id={textareaId}
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
          <div className="absolute right-3 top-3">
            <FiCheckCircle className="h-5 w-5 text-green-500" />
          </div>
        )}
        {validationState === 'error' && (
          <div className="absolute right-3 top-3">
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
};






























'use client';

import { useState, useEffect, useRef } from 'react';
import type { ValidationResult } from '@/lib/validation';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  validator: (v: string) => ValidationResult;
  onValidityChange?: (valid: boolean) => void;
  placeholder?: string;
  type?: 'text' | 'tel' | 'email';
  maxLength?: number;
  required?: boolean;
  helperText?: string;
  uppercase?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  monospace?: boolean;
  disabled?: boolean;
  showCounter?: boolean;
  exampleLabel?: string;
};

export default function ValidatedInput({
  label,
  value,
  onChange,
  validator,
  onValidityChange,
  placeholder,
  type = 'text',
  maxLength,
  required,
  helperText,
  uppercase,
  autoComplete = 'off',
  inputMode,
  monospace,
  disabled,
  showCounter,
  exampleLabel = 'Contoh:',
}: Props) {
  const [touched, setTouched] = useState(false);
  const [result, setResult] = useState<ValidationResult>({ ok: true });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const r = validator(value);
    setResult(r);
    onValidityChange?.(r.ok);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const showError = touched && !result.ok;
  const showSuccess = touched && result.ok && value.trim().length > 0 && required !== false;

  return (
    <div className="mb-4">
      <label className="block text-[12px] font-semibold text-ink-soft mb-1.5 tracking-wide uppercase">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type={type}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const v = uppercase ? e.target.value.toUpperCase() : e.target.value;
            onChange(v);
          }}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          spellCheck={false}
          className={[
            'w-full px-3.5 py-3 rounded-[14px] bg-paper outline-none transition-all',
            'border-[1.5px] text-[15px]',
            monospace ? 'font-mono tracking-widest text-center text-base' : '',
            showError
              ? 'border-danger bg-[#fff7f9]'
              : showSuccess
              ? 'border-success/50'
              : 'border-line focus:border-accent focus:shadow-[0_0_0_3px_rgba(139,145,232,0.2)]',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />

        {showSuccess && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success text-lg pointer-events-none">
            ✓
          </span>
        )}
      </div>

      {/* Counter */}
      {showCounter && maxLength && (
        <div className="text-[11px] text-ink-faint text-right mt-1">
          {value.length} / {maxLength}
        </div>
      )}

      {/* Error block dengan hint + example */}
      {showError && (
        <div className="mt-1.5 px-3 py-2 rounded-[10px] bg-[#fff4f6] border border-[#f6c8d2] animate-fade-in">
          <div className="text-[12px] font-semibold text-danger flex items-start gap-1.5">
            <span className="leading-none mt-0.5">⚠</span>
            <span>{result.error}</span>
          </div>
          {result.hint && (
            <div className="text-[11px] text-ink-soft mt-1 leading-relaxed">
              {result.hint}
            </div>
          )}
          {result.example && (
            <div className="text-[11px] mt-1.5 flex items-center gap-1.5">
              <span className="text-ink-faint">{exampleLabel}</span>
              <span className="font-mono text-accent-deep bg-accent-soft px-1.5 py-0.5 rounded">
                {result.example}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Helper text saat tidak ada error */}
      {!showError && helperText && (
        <p className="text-[11px] text-ink-faint mt-1.5">{helperText}</p>
      )}
    </div>
  );
}

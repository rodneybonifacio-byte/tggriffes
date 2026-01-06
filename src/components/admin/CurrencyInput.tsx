import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number; // in cents
  onChange: (cents: number) => void;
  className?: string;
  required?: boolean;
}

export const CurrencyInput = ({ value, onChange, className, required }: CurrencyInputProps) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (cents: number): string => {
    if (cents === 0) return '';
    return (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseCurrency = (str: string): number => {
    // Remove everything except digits and comma/dot
    const cleaned = str.replace(/[^\d,\.]/g, '');
    // Replace comma with dot for parsing
    const normalized = cleaned.replace(',', '.');
    const parsed = parseFloat(normalized);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number without formatting for easy editing
    if (value > 0) {
      setDisplayValue((value / 100).toString().replace('.', ','));
    } else {
      setDisplayValue('');
    }
    // Select all text for easy replacement
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const cents = parseCurrency(displayValue);
    onChange(cents);
    setDisplayValue('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only digits, comma, and dot
    const filtered = raw.replace(/[^\d,\.]/g, '');
    setDisplayValue(filtered);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        R$
      </span>
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className={cn("pl-9", className)}
        value={isFocused ? displayValue : formatCurrency(value)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="0,00"
        required={required}
      />
    </div>
  );
};

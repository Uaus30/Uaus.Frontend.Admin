import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";

type CurrencyInputProps = {
  /** Optional element ID for reference / focus management */
  id?: string;
  /** Numeric price value (e.g., 12.34) */
  value: number;
  /** Callback triggered on blur with the updated numeric value */
  onChange: (val: number) => void;
  /** Styling classnames to pass down to the UI input */
  className?: string;
};

/**
 * CurrencyInput
 * 
 * A controlled input component specialized in formatting numbers as Brazilian Real currency (R$).
 * - On focus, it shows a user-friendly editable numeric string with comma decimals (e.g. "12,34").
 * - On blur, it parses the string back to a float number and calls onChange.
 * - Out of focus, it displays a read-only nicely formatted currency string (e.g. "R$ 12,34").
 */
export function CurrencyInput({ id, value, onChange, className }: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString().replace(".", ","));

  useEffect(() => {
    if (!focused) {
      setLocalValue(value.toString().replace(".", ","));
    }
  }, [value, focused]);

  if (!focused) {
    return (
      <Input
        id={id}
        type="text"
        value={formatCurrency(value)}
        onFocus={() => {
          setFocused(true);
          if (value === 0) setLocalValue("");
        }}
        readOnly
        className={className}
      />
    );
  }

  return (
    <Input
      id={id}
      autoFocus
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => {
        let val = e.target.value;
        val = val.replace(/\./g, ",");
        val = val.replace(/[^\d,]/g, "");
        const parts = val.split(",");
        if (parts.length > 2) {
          val = parts[0] + "," + parts.slice(1).join("");
        }
        setLocalValue(val);
      }}
      onBlur={() => {
        setFocused(false);
        const numericValue = Number(localValue.replace(",", "."));
        onChange(isNaN(numericValue) ? 0 : numericValue);
      }}
      className={`${className} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
    />
  );
}

import React, { useState, useEffect } from "react";
import { Input } from "@workspace/ui";
import { evaluateAmountFormula, formatCurrency, isAmountFormula } from "@workspace/core";

type CurrencyInputProps = {
  /** Optional element ID for reference / focus management */
  id?: string;
  /** Numeric price value (e.g., 12.34) */
  value: number;
  /** Callback triggered on blur with the updated numeric value */
  onChange: (val: number) => void;
  /** Styling classnames to pass down to the UI input */
  className?: string;
  /**
   * Bloqueia a edição sem esconder o valor.
   *
   * Fora de foco o campo já é `readOnly` para exibir a moeda formatada — o que
   * esta marca faz é impedir a ENTRADA no modo de edição, que é o que a compra
   * lançada precisa: o valor continua legível, e o clique não abre o campo.
   */
  readOnly?: boolean;
  /**
   * Libera a conta no próprio campo: digitando "=17,99*2" o valor vira 35,98 ao
   * sair. Ver `evaluateAmountFormula` no `@workspace/core`.
   *
   * É opção, e não o padrão, porque relaxa o filtro de digitação: o campo passa
   * a aceitar operadores e parênteses. Onde a fórmula não faz sentido, o
   * comportamento antigo (só dígito e vírgula) continua valendo e não há como
   * digitar algo que o campo não entenda.
   */
  allowFormula?: boolean;
};

/**
 * O que o campo aceita enquanto se digita.
 *
 * Sem fórmula, só dígito e vírgula — o ponto é convertido em vírgula na hora,
 * que é o que faz o teclado numérico funcionar. Com fórmula, entram os
 * operadores e os parênteses; o `=` inicial é o que distingue conta de valor.
 */
function sanitizeInput(raw: string, allowFormula: boolean): string {
  if (allowFormula && isAmountFormula(raw)) return raw.replace(/[^\d.,+\-*/()=\s]/g, "");

  let value = raw.replace(/\./g, ",").replace(/[^\d,]/g, "");
  const parts = value.split(",");
  if (parts.length > 2) value = parts[0] + "," + parts.slice(1).join("");
  return value;
}

/**
 * CurrencyInput
 *
 * A controlled input component specialized in formatting numbers as Brazilian Real currency (R$).
 * - On focus, it shows a user-friendly editable numeric string with comma decimals (e.g. "12,34").
 * - On blur, it parses the string back to a float number and calls onChange.
 * - Out of focus, it displays a read-only nicely formatted currency string (e.g. "R$ 12,34").
 */
export function CurrencyInput({
  id,
  value,
  onChange,
  className,
  readOnly,
  allowFormula = false,
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString().replace(".", ","));

  useEffect(() => {
    if (!focused) {
      setLocalValue(value.toString().replace(".", ","));
    }
  }, [value, focused]);

  if (!focused || readOnly) {
    return (
      <Input
        id={id}
        type="text"
        value={formatCurrency(value)}
        onFocus={() => {
          if (readOnly) return;
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
      onChange={(e) => setLocalValue(sanitizeInput(e.target.value, allowFormula))}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !allowFormula || !isAmountFormula(localValue)) return;

        // A conta só é resolvida no blur. Dentro de um <form>, o Enter enviaria
        // o formulário antes disso — com o valor ANTIGO no campo. Sair do campo
        // resolve a conta e deixa o segundo Enter enviar o que se vê.
        event.preventDefault();
        event.currentTarget.blur();
      }}
      onBlur={() => {
        setFocused(false);

        if (allowFormula && isAmountFormula(localValue)) {
          const result = evaluateAmountFormula(localValue);
          // Conta que não fecha não zera o campo: o valor anterior volta (o
          // efeito acima reescreve `localValue` a partir de `value`). Zerar
          // apagaria em silêncio um total que já estava certo.
          if (result !== null) onChange(result);
          return;
        }

        const numericValue = Number(localValue.replace(",", "."));
        onChange(isNaN(numericValue) ? 0 : numericValue);
      }}
      className={`${className} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
    />
  );
}

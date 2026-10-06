import React from "react";
import { DatePicker, Input, formatDateInput, parseDateInput } from "@workspace/ui";
import type { SaleWhen } from "../lib/sale-when";

type SaleWhenFieldProps = {
  value: SaleWhen;
  onChange: (value: SaleWhen) => void;
  /**
   * O que a data escolhida muda — a venda nova e a correção têm avisos
   * diferentes, e o mês com fechamento financeiro soma o dele.
   */
  notices?: Array<string | null>;
  /** Data que não muda (a venda do PDV): mostra, sem deixar mexer. */
  disabled?: boolean;
};

/**
 * Data e hora da venda (06/10/2026). A data é o calendário do kit (nunca o
 * `<input type="date">` do navegador, ver o README do kit); a hora é um campo de
 * hora simples, que no celular abre o seletor do próprio aparelho.
 */
export function SaleWhenField({ value, onChange, notices = [], disabled }: SaleWhenFieldProps) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Quando foi a venda</span>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <DatePicker
          value={parseDateInput(value.date)}
          onChange={(date) => date && onChange({ ...value, date: formatDateInput(date) })}
          maxDate={new Date()}
          clearable={false}
          disabled={disabled}
          className="h-10"
        />
        <Input
          type="time"
          value={value.time}
          onChange={(event) => onChange({ ...value, time: event.target.value })}
          aria-label="Hora da venda"
          disabled={disabled}
          className="h-10 bg-background"
        />
      </div>
      {notices
        .filter((notice): notice is string => Boolean(notice))
        .map((notice) => (
          // Âmbar, o "atenção" da casa, com o texto dizendo o que muda.
          <p
            key={notice}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
          >
            {notice}
          </p>
        ))}
    </div>
  );
}

/**
 * DateRangePicker — Uaus Design System
 *
 * Calendário único para seleção de período (início → fim) no padrão da tela de
 * logs, em modo dark, usando react-datepicker com CSS customizado via
 * variáveis do tema. O componente notifica o onChange mas NÃO dispara busca
 * automática.
 *
 * As peças de layout (gatilho e painel flutuante) vivem em `date-field.tsx` e
 * são compartilhadas com o `DatePicker` de data única.
 */

import { useState, useRef, useId } from "react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import { startOfDay, endOfDay } from "date-fns";
import {
  CalendarPanel,
  DateFieldTrigger,
  FloatingCalendarPortal,
  formatDateLabel,
} from "@/components/ui/date-field";
import "react-datepicker/dist/react-datepicker.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  /** Texto exibido quando não há período selecionado. */
  placeholder?: string;
  /** Menor data selecionável. */
  minDate?: Date;
  /** Maior data selecionável. */
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  /** Id do gatilho, para associar a um `<Label htmlFor>`. */
  id?: string;
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Selecionar período",
  minDate,
  maxDate,
  disabled,
  className,
  id,
}: DateRangePickerProps) {
  const uid = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Estado interno do range — sincronizado com value ao abrir
  const [startDate, setStartDate] = useState<Date | null>(value?.from ?? null);
  const [endDate, setEndDate] = useState<Date | null>(value?.to ?? null);

  function handleToggle() {
    if (disabled) return;
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setAnchorRect(rect);
      // Sincroniza draft ao abrir
      setStartDate(value?.from ?? null);
      setEndDate(value?.to ?? null);
    }
    setOpen((v) => !v);
  }

  function handleClose() {
    setOpen(false);
  }

  // react-datepicker com selectsRange passa [Date|null, Date|null]
  function handleChange([start, end]: [Date | null, Date | null]) {
    setStartDate(start);
    setEndDate(end);
    // Notifica o pai (draft) — quem decide quando buscar é o componente pai
    onChange?.({
      from: start ? startOfDay(start) : undefined,
      to: end ? endOfDay(end) : undefined,
    });
    // NÃO fecha — usuário fecha clicando fora ou pressionando Esc
  }

  function handleClear(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    setStartDate(null);
    setEndDate(null);
    onChange?.({ from: undefined, to: undefined });
  }

  function formatLabel() {
    if (!startDate) return placeholder;
    if (!endDate) return formatDateLabel(startDate);
    return `${formatDateLabel(startDate)} → ${formatDateLabel(endDate)}`;
  }

  return (
    <>
      <DateFieldTrigger
        id={id ?? uid}
        triggerRef={triggerRef}
        label={formatLabel()}
        hasValue={!!startDate}
        open={open}
        disabled={disabled}
        onToggle={handleToggle}
        onClear={handleClear}
        clearLabel="Limpar período"
        className={className}
      />

      {open && anchorRect && (
        <FloatingCalendarPortal anchor={anchorRect} onClose={handleClose}>
          <CalendarPanel>
            <DatePicker
              selected={startDate}
              // @ts-ignore — selectsRange onChange signature
              onChange={handleChange}
              startDate={startDate}
              endDate={endDate}
              minDate={minDate}
              maxDate={maxDate}
              selectsRange
              inline
              locale={ptBR}
              monthsShown={1}
              todayButton="Data atual"
              showPopperArrow={false}
            />
          </CalendarPanel>
        </FloatingCalendarPortal>
      )}
    </>
  );
}

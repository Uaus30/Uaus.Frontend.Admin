/**
 * DatePicker — Uaus Design System
 *
 * Seleção de **uma** data, no mesmo padrão visual do `DateRangePicker` usado na
 * tela de logs. Substitui `<input type="date">` em formulários (data de
 * entrada, vencimento, etc).
 *
 * Diferente do range, fecha assim que o usuário escolhe o dia — não há segundo
 * clique a esperar.
 */

import { useId, useRef, useState } from "react";
import DatePickerLib from "react-datepicker";
import { ptBR } from "date-fns/locale";
import {
  CalendarPanel,
  DateFieldTrigger,
  FloatingCalendarPortal,
  formatDateLabel,
} from "@/components/ui/date-field";
import "react-datepicker/dist/react-datepicker.css";

export interface DatePickerProps {
  /** Data selecionada. */
  value?: Date;
  /** Notificado a cada seleção — o pai decide o que fazer com o valor. */
  onChange?: (date: Date | undefined) => void;
  /** Texto exibido quando não há data. */
  placeholder?: string;
  /** Menor data selecionável. */
  minDate?: Date;
  /** Maior data selecionável. */
  maxDate?: Date;
  /** Exibe o "x" de limpar no hover. Desligue em campos obrigatórios. */
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  /** Id do gatilho, para associar a um `<Label htmlFor>`. */
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecionar data",
  minDate,
  maxDate,
  clearable = true,
  disabled,
  className,
  id,
}: DatePickerProps) {
  const uid = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  function handleToggle() {
    if (disabled) return;
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setAnchorRect(rect);
    }
    setOpen((v) => !v);
  }

  function handleChange(date: Date | null) {
    onChange?.(date ?? undefined);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
    onChange?.(undefined);
  }

  return (
    <>
      <DateFieldTrigger
        id={id ?? uid}
        triggerRef={triggerRef}
        label={value ? formatDateLabel(value) : placeholder}
        hasValue={!!value}
        open={open}
        disabled={disabled}
        onToggle={handleToggle}
        onClear={clearable ? handleClear : undefined}
        clearLabel="Limpar data"
        className={className}
      />

      {open && anchorRect && (
        <FloatingCalendarPortal anchor={anchorRect} onClose={() => setOpen(false)}>
          <CalendarPanel>
            <DatePickerLib
              selected={value ?? null}
              onChange={handleChange}
              minDate={minDate}
              maxDate={maxDate}
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

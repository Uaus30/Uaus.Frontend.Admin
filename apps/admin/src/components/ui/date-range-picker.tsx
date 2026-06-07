/**
 * DateRangePicker — Uaus Design System
 *
 * Calendário único para seleção de período (início → fim) no estilo do LIMS,
 * em modo dark, usando react-datepicker com CSS customizado via variáveis do tema.
 * O componente notifica o onChange mas NÃO dispara busca automática.
 */

import { useState, useRef, useEffect, useId } from "react";
import DatePicker from "react-datepicker";
import { ptBR } from "date-fns/locale";
import { format, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import "react-datepicker/dist/react-datepicker.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  disabled?: boolean;
  className?: string;
}

// ─── Portal flutuante ─────────────────────────────────────────────────────────

interface FloatingProps {
  anchor: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}

function FloatingCalendarPortal({ anchor, onClose, children }: FloatingProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Posiciona abaixo do gatilho, alinhado à esquerda
  const top = anchor.bottom + window.scrollY + 6;
  const left = anchor.left + window.scrollX;

  return createPortal(
    <div
      ref={ref}
      data-portal="true"
      style={{ position: "absolute", top, left, zIndex: 9999 }}
      className="animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {children}
    </div>,
    document.body,
  );
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

export function DateRangePicker({
  value,
  onChange,
  disabled,
  className,
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

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setStartDate(null);
    setEndDate(null);
    onChange?.({ from: undefined, to: undefined });
  }

  const hasValue = !!startDate;

  function formatLabel() {
    if (!startDate) return "Selecionar período";
    if (!endDate) return format(startDate, "dd/MM/yyyy", { locale: ptBR });
    return `${format(startDate, "dd/MM/yyyy")} → ${format(endDate, "dd/MM/yyyy")}`;
  }

  return (
    <>
      {/* ── Botão gatilho ── */}
      <button
        ref={triggerRef}
        id={uid}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-expanded={open}
        className={cn(
          "group flex items-center gap-2.5 h-9 w-full rounded-lg px-3",
          "border border-input bg-background text-sm text-left",
          "transition-all duration-150",
          "hover:border-ring/50 hover:bg-muted/20",
          open && "border-ring ring-2 ring-ring/20 bg-muted/10",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        <CalendarIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            hasValue ? "text-primary" : "text-muted-foreground",
            open && "text-primary",
          )}
        />
        <span
          className={cn(
            "flex-1 truncate font-mono text-xs",
            hasValue ? "text-foreground" : "text-muted-foreground/60",
          )}
        >
          {formatLabel()}
        </span>
        {hasValue && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            onKeyDown={(e) => e.key === "Enter" && handleClear(e as never)}
            aria-label="Limpar período"
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* ── Calendário flutuante ── */}
      {open && anchorRect && (
        <FloatingCalendarPortal anchor={anchorRect} onClose={handleClose}>
          <div className="uaus-rdp-dark">
            <DatePicker
              selected={startDate}
              // @ts-ignore — selectsRange onChange signature
              onChange={handleChange}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              inline
              locale={ptBR}
              monthsShown={1}
              todayButton="Data atual"
              showPopperArrow={false}
            />
          </div>
        </FloatingCalendarPortal>
      )}
    </>
  );
}

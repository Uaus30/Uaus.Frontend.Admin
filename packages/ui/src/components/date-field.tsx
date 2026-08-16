/**
 * date-field — Primitivos do padrão de calendário Uaus
 *
 * Peças compartilhadas por `DatePicker` (data única) e `DateRangePicker`
 * (período). O padrão visual é o da tela de logs: um gatilho de 36px com ícone
 * de calendário e rótulo em fonte mono, abrindo um painel escuro flutuante
 * (`.uaus-rdp-dark`, definido no `index.css`) sobre o `document.body`.
 *
 * Toda tela que precisar de calendário deve montar em cima daqui, nunca com
 * `<input type="date">` — o controle nativo ignora o tema e muda de aparência
 * conforme o navegador.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "../lib/utils";

// ─── Conversão string ↔ Date ──────────────────────────────────────────────────

/** Formato das datas que trafegam como string em filtros e payloads. */
export const DATE_INPUT_FORMAT = "yyyy-MM-dd";

/**
 * Converte `yyyy-MM-dd` em `Date` no fuso local.
 *
 * `new Date("2026-07-18")` seria interpretado como meia-noite UTC e, no
 * horário de Brasília, voltaria um dia no calendário. O parse explícito
 * mantém o dia que o usuário enxerga.
 */
export function parseDateInput(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, DATE_INPUT_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

/** Converte `Date` de volta para `yyyy-MM-dd` (string vazia quando não há data). */
export function formatDateInput(date?: Date | null): string {
  if (!date || !isValid(date)) return "";
  return format(date, DATE_INPUT_FORMAT);
}

/** Rótulo curto de uma data no formato brasileiro. */
export function formatDateLabel(date: Date): string {
  return format(date, "dd/MM/yyyy");
}

// ─── Integração com camadas do Radix ──────────────────────────────────────────

/** Marca o portal do calendário no DOM. */
export const CALENDAR_PORTAL_ATTRIBUTE = "data-uaus-calendar-portal";

/**
 * Indica se o alvo do evento está dentro do painel do calendário.
 *
 * O painel vive no `document.body`, então para um `Dialog`/`Popover` do Radix
 * clicar num dia é "clicar fora" e fecharia a camada.
 */
export function isInsideCalendarPortal(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(`[${CALENDAR_PORTAL_ATTRIBUTE}]`);
}

/**
 * Guarda para `onInteractOutside` / `onFocusOutside` de camadas do Radix que
 * hospedem um calendário. Sem ela, selecionar uma data fecha o modal em volta.
 *
 * @example
 * <DialogContent onInteractOutside={guardCalendarDismiss}>
 */
export function guardCalendarDismiss(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}): void {
  if (isInsideCalendarPortal(event.target)) event.preventDefault();
}

// ─── Portal flutuante ─────────────────────────────────────────────────────────

/** Respiro entre o gatilho e o painel, e entre o painel e a borda da tela. */
const PANEL_OFFSET = 6;
const VIEWPORT_MARGIN = 8;

interface FloatingCalendarPortalProps {
  /** Retângulo do gatilho, medido no momento da abertura. */
  anchor: DOMRect;
  /** Chamado ao clicar fora do painel ou pressionar Esc. */
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Renderiza o painel do calendário no `document.body`, ancorado abaixo do
 * gatilho. Se não couber à direita ou abaixo, reposiciona para dentro da tela —
 * o mesmo calendário é usado em barras de filtro coladas na borda direita.
 *
 * O `pointerEvents: "auto"` do painel não é enfeite: enquanto um `Dialog` modal
 * do Radix está aberto, ele zera o `pointer-events` do `<body>` para prender o
 * clique dentro do modal. Como este portal é um `createPortal` no `body` — e não
 * um portal do Radix —, ele herda esse bloqueio: o calendário aparece, mas
 * nenhum dia aceita clique, e o `mousedown` que vaza para o `body` ainda fecha o
 * painel. Era o que acontecia em todo formulário com data dentro de modal.
 */
export function FloatingCalendarPortal({ anchor, onClose, children }: FloatingCalendarPortalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

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

  // Mede o painel antes da pintura para que o ajuste de borda não pisque.
  useLayoutEffect(() => {
    if (!ref.current) return;
    const { offsetWidth, offsetHeight } = ref.current;
    setSize({ width: offsetWidth, height: offsetHeight });
  }, []);

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  // Abaixo do gatilho por padrão; acima quando não há espaço embaixo.
  const opensUpward =
    !!size &&
    anchor.bottom + PANEL_OFFSET + size.height > viewportHeight &&
    anchor.top - PANEL_OFFSET - size.height >= 0;

  const top = opensUpward
    ? anchor.top - PANEL_OFFSET - (size?.height ?? 0) + window.scrollY
    : anchor.bottom + PANEL_OFFSET + window.scrollY;

  const maxLeft = viewportWidth - (size?.width ?? 0) - VIEWPORT_MARGIN;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, maxLeft)) + window.scrollX;

  return createPortal(
    <div
      ref={ref}
      data-portal="true"
      {...{ [CALENDAR_PORTAL_ATTRIBUTE]: "true" }}
      style={{
        position: "absolute",
        top,
        left,
        zIndex: 9999,
        // Devolve o clique ao painel; ver o porquê no bloco acima.
        pointerEvents: "auto",
        // Evita o salto do primeiro frame, antes de o painel ser medido.
        visibility: size ? "visible" : "hidden",
      }}
      className="animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {children}
    </div>,
    document.body,
  );
}

/** Casca escura do calendário — aplica o tema `.uaus-rdp-dark`. */
export function CalendarPanel({ children }: { children: React.ReactNode }) {
  return <div className="uaus-rdp-dark">{children}</div>;
}

// ─── Gatilho ──────────────────────────────────────────────────────────────────

export interface DateFieldTriggerProps {
  /** Texto exibido — a data, o período ou o placeholder. */
  label: string;
  /** True quando há data selecionada (muda cor do ícone e libera o "limpar"). */
  hasValue: boolean;
  /** True enquanto o painel está aberto. */
  open: boolean;
  disabled?: boolean;
  /** Abre/fecha o painel. */
  onToggle: () => void;
  /** Quando informado, exibe o "x" de limpar no hover. */
  onClear?: (e: React.MouseEvent | React.KeyboardEvent) => void;
  /** Descrição do que está sendo limpo, para leitores de tela. */
  clearLabel?: string;
  className?: string;
  id?: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Botão que abre o calendário. É o elemento que dá identidade visual ao padrão:
 * mesma altura dos inputs e selects, ícone à esquerda e data em fonte mono.
 */
export function DateFieldTrigger({
  label,
  hasValue,
  open,
  disabled,
  onToggle,
  onClear,
  clearLabel = "Limpar data",
  className,
  id,
  triggerRef,
}: DateFieldTriggerProps) {
  return (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      disabled={disabled}
      onClick={onToggle}
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
        {label}
      </span>
      {hasValue && onClear && (
        <span
          role="button"
          tabIndex={0}
          onClick={onClear}
          onKeyDown={(e) => e.key === "Enter" && onClear(e)}
          aria-label={clearLabel}
          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}

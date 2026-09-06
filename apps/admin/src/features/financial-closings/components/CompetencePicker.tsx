import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui";
import { CalendarClock, CalendarOff, CircleCheck, CircleDashed, Info, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatCompetenceRange } from "../month-selection";
import type { MonthAvailability, MonthOption } from "../types";

/**
 * Psicologia das cores do select de mês: verde libera, âmbar pede atenção,
 * cinza tranca. Cada estado tem também **ícone e texto próprios** — cor
 * sozinha não informa quem não distingue verde de âmbar, e o cadeado diz
 * "já fechado" mesmo em preto e branco.
 */
const MONTH_STATUS: Record<MonthAvailability, { label: string; icon: LucideIcon; className: string }> = {
  disponivel: { label: "Disponível", icon: CircleCheck, className: "text-emerald-600" },
  "em-andamento": { label: "Em andamento", icon: CircleDashed, className: "text-amber-600" },
  fechado: { label: "Fechado", icon: Lock, className: "text-muted-foreground" },
  "nao-iniciado": { label: "Não iniciado", icon: CalendarOff, className: "text-muted-foreground" },
};

/** Texto da legenda de cada estado — o que o tooltip do rótulo "Mês" explica. */
const LEGEND: Record<MonthAvailability, string> = {
  disponivel: "Disponível: mês encerrado e sem fechamento.",
  "em-andamento": "Em andamento: mês corrente, dados ainda parciais.",
  fechado: "Fechado: já existe fechamento cobrindo o mês.",
  "nao-iniciado": "Não iniciado: mês futuro, nada a fechar.",
};

interface CompetencePickerProps {
  year: number;
  /** Mês escolhido (1–12) ou `null` enquanto ninguém escolheu. */
  month: number | null;
  yearOptions: number[];
  monthOptions: MonthOption[];
  /** Enquanto os meses fechados não chegam, o select fica travado. */
  isLoadingMonths: boolean;
  /** Trava tudo durante o cálculo da prévia. */
  disabled: boolean;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onApplyLastMonth: () => void;
}

/**
 * CompetencePicker
 *
 * Escolha da competência do fechamento: um select de ano (o atual
 * pré-selecionado) e um select de mês em que **só os meses ainda sem fechamento
 * são selecionáveis**. Substituiu o calendário de período livre — o fechamento
 * é sempre um mês-calendário inteiro, que é o que os custos fixos já assumiam.
 */
export function CompetencePicker({
  year,
  month,
  yearOptions,
  monthOptions,
  isLoadingMonths,
  disabled,
  onYearChange,
  onMonthChange,
  onApplyLastMonth,
}: CompetencePickerProps) {
  const selected = monthOptions.find((option) => option.month === month) ?? null;

  return (
    <div className="space-y-4 pt-2">
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="closing-year">Ano</Label>
          <Select
            value={String(year)}
            onValueChange={(value) => onYearChange(Number(value))}
            disabled={disabled}
          >
            <SelectTrigger id="closing-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="closing-month">Mês</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="h-3.5 w-3.5" />
                  <span className="sr-only">Legenda dos meses</span>
                </button>
              </TooltipTrigger>
              {/*
                `TooltipContent` e `DialogContent` nascem os dois com `z-50`:
                dentro do diálogo, o empate deixa a legenda ATRÁS da modal (foi
                assim que ela apareceu no primeiro smoke test). O `z-[60]` é o
                desempate local — a legenda flutua sobre o diálogo que a chamou.
              */}
              <TooltipContent side="bottom" className="z-[60] max-w-xs">
                <ul className="space-y-1">
                  {(Object.keys(MONTH_STATUS) as MonthAvailability[]).map((availability) => (
                    <li key={availability} className="flex items-center gap-2">
                      {/*
                        Sem cor aqui: o fundo do tooltip é o primary, e o cinza
                        de "fechado" sobre ele fica ilegível. Na legenda quem
                        distingue é o formato do ícone; a cor faz o trabalho no
                        select, onde o fundo é neutro.
                      */}
                      <MonthStatusIcon availability={availability} plain />
                      <span>{LEGEND[availability]}</span>
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>

          <Select
            value={month != null ? String(month) : ""}
            onValueChange={(value) => onMonthChange(Number(value))}
            disabled={disabled || isLoadingMonths}
          >
            <SelectTrigger id="closing-month">
              <SelectValue placeholder={isLoadingMonths ? "Carregando meses..." : "Selecione o mês"} />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.month} value={String(option.month)} disabled={option.disabled}>
                  <span className="flex items-center gap-2">
                    <MonthStatusIcon availability={option.availability} />
                    <span>{option.label}</span>
                    {option.availability !== "disponivel" && (
                      <span className={`text-xs ${MONTH_STATUS[option.availability].className}`}>
                        {MONTH_STATUS[option.availability].label}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onApplyLastMonth}
        disabled={disabled}
        className="gap-1.5"
      >
        <CalendarClock className="h-4 w-4" />
        Último mês
      </Button>

      {selected && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-muted-foreground">
            Período do fechamento:{" "}
            <span className="font-medium text-foreground">
              {formatCompetenceRange({ year, month: selected.month })}
            </span>
          </p>
          {selected.availability === "em-andamento" && (
            <p className="mt-1 flex items-start gap-1.5 text-amber-600">
              <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Mês ainda em andamento: o fechamento congelaria dados parciais e travaria o resto do mês.
            </p>
          )}
          {selected.availability === "fechado" && (
            <p className="mt-1 flex items-start gap-1.5 text-destructive">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Este mês já tem fechamento. Exclua o existente para refazer.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        O fechamento cobre o mês-calendário inteiro: os custos fixos entram por competência mensal, com o
        valor cheio do mês e sem pró-rata.
      </p>
    </div>
  );
}

/** Ícone do estado do mês — colorido por padrão, `plain` herda a cor do texto. */
function MonthStatusIcon({ availability, plain }: { availability: MonthAvailability; plain?: boolean }) {
  const { icon: Icon, className } = MONTH_STATUS[availability];
  return <Icon className={`h-3.5 w-3.5 shrink-0 ${plain ? "" : className}`} />;
}

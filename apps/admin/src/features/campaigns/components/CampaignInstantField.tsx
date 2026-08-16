import { DatePicker, Input, Label } from "@workspace/ui";

interface CampaignInstantFieldProps {
  id: string;
  label: string;
  /** Dia escolhido. `undefined` = campo vazio. */
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  /** Hora `"HH:mm"`. */
  time: string;
  onTimeChange: (time: string) => void;
  /** Campo obrigatório: esconde o "x" de limpar do calendário. */
  required?: boolean;
  /** Texto de apoio abaixo do par de campos. */
  hint?: string;
}

/**
 * CampaignInstantField
 *
 * Um instante = um dia + uma hora, lado a lado.
 *
 * O `DatePicker` de `packages/ui` trabalha só com `Date` de **calendário** — e
 * é assim que ele deve continuar, porque a maioria das telas do admin escolhe
 * dia, não instante. O controle de hora, então, é montado aqui dentro da
 * feature, e a composição da string `"yyyy-MM-ddTHH:mm:ss"` fica em
 * `campaignRules.ts`.
 *
 * A hora existe porque o período da campanha é instante e não data: ela pode
 * durar uma tarde ("das 14h às 20h de sábado") ou atravessar meses, e o
 * relatório compara com o faturamento da loja no mesmo intervalo, hora a hora.
 * Um período truncado no dia tornaria a campanha de uma tarde indistinguível de
 * uma que durou o dia inteiro.
 */
export function CampaignInstantField({
  id,
  label,
  date,
  onDateChange,
  time,
  onTimeChange,
  required,
  hint,
}: CampaignInstantFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <DatePicker
            id={id}
            value={date}
            onChange={onDateChange}
            placeholder="Selecionar data"
            clearable={!required}
            className="h-10 w-full"
          />
        </div>

        <Input
          type="time"
          aria-label={`Hora — ${label}`}
          value={time}
          onChange={(event) => onTimeChange(event.target.value)}
          // Sem dia escolhido a hora não compõe instante nenhum; deixá-la
          // editável sugeriria um período que não existe.
          disabled={!date}
          className="h-10 w-28 shrink-0"
        />
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

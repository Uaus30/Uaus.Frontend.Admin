import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info } from "lucide-react";
import type { InventoryCountLineDto, InventoryCountResultDto } from "@workspace/api-client-react";
import { Badge } from "@workspace/ui";
import { formatQuantity } from "@/lib/formatters";

type InventoryCountResultProps = {
  result: InventoryCountResultDto;
  /** A contagem já foi aplicada — o que está na tela é histórico, não projeção. */
  isApplied: boolean;
};

/**
 * InventoryCountResult
 *
 * Mostra o impacto de uma planilha de contagem: faltas, sobras e as linhas que o
 * sistema não conseguiu aproveitar.
 *
 * Usado tanto na prévia quanto depois de aplicar, com o mesmo layout de
 * propósito: o dono confere a prévia e precisa reconhecer exatamente aquilo no
 * resultado.
 */
export function InventoryCountResult({ result, isApplied }: InventoryCountResultProps) {
  return (
    <div className="flex flex-col gap-4">
      <Summary result={result} isApplied={isApplied} />

      {result.isBlocked && result.blockReason && (
        <Callout tone="destructive" icon={AlertTriangle} title="A planilha não pode ser aplicada">
          {result.blockReason}
        </Callout>
      )}

      {!result.isBlocked && result.hasNoChanges && (
        <Callout tone="muted" icon={CheckCircle2} title="Nenhuma diferença encontrada">
          O que foi contado bate com o que o sistema tem. Não há nada a corrigir.
        </Callout>
      )}

      {result.notCountedRows > 0 && (
        <Callout tone="muted" icon={Info} title={`${result.notCountedRows} produto(s) não contado(s)`}>
          Linhas com a coluna de contagem em branco foram ignoradas — em branco significa
          não contado, e nunca zero. Elas continuam com o saldo atual.
        </Callout>
      )}

      <LineTable
        title="Faltas"
        description="Contou menos do que o sistema tinha. Vira baixa de estoque por inventário."
        icon={ArrowDownRight}
        tone="destructive"
        lines={result.shortages}
      />

      <LineTable
        title="Sobras"
        description="Contou mais do que o sistema tinha. Vira entrada de estoque de ajuste."
        icon={ArrowUpRight}
        tone="emerald"
        lines={result.surpluses}
      />

      {result.issues.length > 0 && <IssueList issues={result.issues} />}
    </div>
  );
}

/** Cartões com os números da contagem. */
function Summary({ result, isApplied }: InventoryCountResultProps) {
  const cards = [
    { label: "Produtos contados", value: formatQuantity(result.countedRows) },
    { label: "Faltas", value: `${result.shortages.length} (${formatQuantity(result.shortageQuantity)} un.)` },
    { label: "Sobras", value: `${result.surpluses.length} (${formatQuantity(result.surplusQuantity)} un.)` },
    { label: "Linhas ignoradas", value: formatQuantity(result.notCountedRows + result.issues.length) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="truncate font-mono text-sm text-muted-foreground">{result.fileName}</p>
        {isApplied && (
          <Badge className="border-none bg-emerald-500 text-white">Aplicada</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border/50 bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-1 font-mono text-xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type LineTableProps = {
  title: string;
  description: string;
  icon: typeof ArrowDownRight;
  tone: "destructive" | "emerald";
  lines: InventoryCountLineDto[];
};

/**
 * Tabela de diferenças.
 *
 * As colunas "na exportação" e "agora" aparecem lado a lado de propósito: a
 * diferença entre elas é venda ocorrida depois da exportação, não erro de
 * contagem, e sem as duas o dono não tem como saber disso.
 */
function LineTable({ title, description, icon: Icon, tone, lines }: LineTableProps) {
  if (lines.length === 0) return null;

  const accent = tone === "destructive" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${accent}`} />
          <h3 className="font-semibold">
            {title} <span className="text-muted-foreground">({lines.length})</span>
          </h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="p-3 text-left font-semibold">Produto</th>
              <th className="p-3 text-right font-semibold">Na exportação</th>
              <th className="p-3 text-right font-semibold">Agora</th>
              <th className="p-3 text-right font-semibold">Contado</th>
              <th className="p-3 text-right font-semibold">Diferença</th>
              <th className="p-3 text-right font-semibold">Ficará com</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.productId} className="border-b border-border/30 last:border-0">
                <td className="p-3">
                  <p className="font-medium leading-tight">{line.productName}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{line.barcode}</p>
                </td>
                <td className="p-3 text-right font-mono">{formatQuantity(line.stockAtExport)}</td>
                <td className="p-3 text-right font-mono">{formatQuantity(line.currentStock)}</td>
                <td className="p-3 text-right font-mono font-semibold">{formatQuantity(line.counted)}</td>
                <td className={`p-3 text-right font-mono font-bold ${accent}`}>
                  {line.difference > 0 ? "+" : ""}
                  {formatQuantity(line.difference)}
                </td>
                <td className="p-3 text-right font-mono">{formatQuantity(line.targetStock)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Linhas que o sistema não conseguiu aproveitar, com o motivo de cada uma. */
function IssueList({ issues }: { issues: InventoryCountResultDto["issues"] }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h3 className="font-semibold">Linhas ignoradas ({issues.length})</h3>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {issues.map((issue) => (
          <li key={`${issue.rowNumber}-${issue.code}`} className="text-xs text-muted-foreground">
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

type CalloutProps = {
  tone: "destructive" | "muted";
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
};

/** Aviso destacado acima das tabelas. */
function Callout({ tone, icon: Icon, title, children }: CalloutProps) {
  const styles =
    tone === "destructive"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-border/50 bg-muted/30 text-muted-foreground";

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs">{children}</p>
      </div>
    </div>
  );
}



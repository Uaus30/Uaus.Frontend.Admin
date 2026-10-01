import {
  CUSTOMER_ACQUISITION_CHANNEL_LABEL,
  CUSTOMER_AGE_RANGE_LABEL,
  CUSTOMER_GENDER_LABEL,
  type LoyaltyChartsDto,
} from "@workspace/api-client-react";
import { ChartCard, SERIES_COLORS } from "@/features/dashboard/components/chart-primitives";

type BarRow = { label: string; value: number };

/**
 * Barras horizontais com o número escrito ao lado: para listas curtas de
 * categorias (etapas, canais, perfil), ler "Indicação 12" é mais rápido que
 * passar o mouse numa barra — e funciona igual no celular.
 */
function HorizontalBars({
  rows,
  color = SERIES_COLORS[0],
  empty,
}: {
  rows: BarRow[];
  color?: string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.every((row) => row.value === 0)) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate text-muted-foreground">{row.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(row.value / max) * 100}%`, backgroundColor: color }}
            />
          </span>
          <span className="text-right font-medium tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

const byCode = (items: { code: number; count: number }[], labels: Record<number, string>) =>
  Object.entries(labels)
    .map(([code, label]) => ({ label, value: items.find((item) => item.code === Number(code))?.count ?? 0 }))
    .filter((row) => row.value > 0 || row.label !== labels[0]);

/**
 * O caminho do cadastro ao cartão completo, como conheceram a loja, o perfil de
 * quem participa e os números por operador (entrega 5). O perfil conta quem
 * carimbou no período; a faixa de idade sai do nascimento quando ele existe.
 */
export function LoyaltyProfileCharts({ charts }: { charts: LoyaltyChartsDto }) {
  const funnel = [
    { label: "Cadastrados", value: charts.funnel.registered },
    { label: "Com carimbo", value: charts.funnel.stamped },
    { label: "Prêmio do meio", value: charts.funnel.reachedMiddle },
    { label: "Cartão completo", value: charts.funnel.completedCard },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard
        title="Do cadastro ao cartão completo"
        description="Clientes cadastrados no período, em cada etapa"
      >
        <HorizontalBars rows={funnel} empty="Nenhum cadastro no período." />
      </ChartCard>

      <ChartCard title="Como conheceram a loja" description="Clientes cadastrados no período">
        <HorizontalBars
          rows={byCode(charts.acquisitionChannels, CUSTOMER_ACQUISITION_CHANNEL_LABEL)}
          color={SERIES_COLORS[2]}
          empty="Nenhum cadastro no período."
        />
      </ChartCard>

      <ChartCard
        title="Perfil de quem participa"
        description="Quem carimbou no período: sexo e faixa de idade"
      >
        <div className="space-y-4">
          <HorizontalBars
            rows={byCode(charts.genders, CUSTOMER_GENDER_LABEL)}
            color={SERIES_COLORS[3]}
            empty="Ninguém carimbou no período."
          />
          <HorizontalBars
            rows={byCode(charts.ageRanges, CUSTOMER_AGE_RANGE_LABEL)}
            color={SERIES_COLORS[4]}
            empty="Sem faixa de idade informada."
          />
        </div>
      </ChartCard>

      <ChartCard
        title="Por operador"
        description="Vendas com cliente e cadastros no período: é aqui que se vê quem pergunta"
        className="lg:col-span-2 xl:col-span-3"
      >
        {charts.operators.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left font-medium">Operador</th>
                  <th className="py-2 text-right font-medium">Vendas</th>
                  <th className="py-2 text-right font-medium">Com cliente</th>
                  <th className="py-2 text-right font-medium">%</th>
                  <th className="py-2 text-right font-medium">Cadastros</th>
                </tr>
              </thead>
              <tbody>
                {charts.operators.map((row, index) => (
                  <tr key={index} className="border-t border-border/50">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2 text-right tabular-nums">{row.sales}</td>
                    <td className="py-2 text-right tabular-nums">{row.salesWithCustomer}</td>
                    <td className="py-2 text-right tabular-nums">
                      {row.sales > 0 ? `${Math.round((row.salesWithCustomer / row.sales) * 100)}%` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">{row.customersRegistered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

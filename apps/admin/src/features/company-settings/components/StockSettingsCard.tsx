import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { STOCK_SETTINGS_ANCHOR } from "@/lib/stock-control";

type StockSettingsCardProps = {
  /** Estoque mínimo dos produtos sem mínimo próprio. */
  defaultMinStock: number;
  onDefaultMinStockChange: (value: number) => void;
  /** Corte da nota de reposição (0 a 100); zero desliga a rotina. */
  restockScoreCutoff: number;
  onRestockScoreCutoffChange: (value: number) => void;
  isSaving: boolean;
};

/**
 * O cartão Estoque das Configurações: o mínimo padrão e, desde 04/10/2026, a
 * nota de corte que tira do controle o produto que chega ao mínimo vendendo mal.
 *
 * O texto da nota de corte é longo de propósito (pedido do dono: "explicação
 * clara sobre o que a configuração faz"). O efeito acontece longe daqui — na
 * rotina diária, no relatório de estoque baixo e na listagem —, e um número
 * sem explicação seria mexido sem saber o que se perde.
 */
export function StockSettingsCard({
  defaultMinStock,
  onDefaultMinStockChange,
  restockScoreCutoff,
  onRestockScoreCutoffChange,
  isSaving,
}: StockSettingsCardProps) {
  return (
    <Card id={STOCK_SETTINGS_ANCHOR} className="scroll-mt-6 border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Estoque</CardTitle>
        <CardDescription>Como o relatório de estoque baixo decide o que precisa de compra.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-6 rounded-xl border border-border/50 bg-background/50 p-4">
          <div className="space-y-1">
            <Label htmlFor="default-min-stock" className="text-sm font-medium">
              Estoque mínimo padrão (unidades)
            </Label>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Vale para todo produto sem estoque mínimo próprio. Com o saldo igual ou abaixo deste número, o
              produto que vende entra no relatório de estoque baixo, mesmo que ainda dure mais de 30 dias.
              Zero desliga o piso: sobra só a previsão de duração.
            </p>
          </div>
          <Input
            id="default-min-stock"
            type="number"
            min={0}
            max={1000}
            step={1}
            value={defaultMinStock}
            onChange={(e) => onDefaultMinStockChange(Number(e.target.value))}
            disabled={isSaving}
            className="w-24 text-right"
          />
        </div>

        <div className="flex items-start justify-between gap-6 rounded-xl border border-border/50 bg-background/50 p-4">
          <div className="space-y-2">
            <Label htmlFor="restock-score-cutoff" className="text-sm font-medium">
              Nota de corte da reposição (0 a 100)
            </Label>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Todo dia o sistema olha os produtos do relatório de estoque baixo. Quem chegou ao estoque mínimo
              (ou esgotou) com a <strong>nota de reposição</strong> abaixo deste número tem o controle de
              estoque desligado sozinho e sai do relatório e do alerta — continua à venda, e aparece na aba
              &quot;Fora do controle&quot; com o motivo &quot;Desempenho fraco&quot;.
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              A nota de reposição vem da apuração de desempenho feita depois da última venda e soma só o que o
              estoque não distorce: margem, lucro contra a média da loja e em quantas semanas o produto
              vendeu. Um produto que vendeu uma unidade em 90 dias com R$ 4 de lucro tira perto de 25; um que
              vende toda semana com boa margem passa de 80.
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Subir o corte limpa mais o relatório, mas pode tirar dele produto que você ainda quer recomprar.
              Produto novo (menos de um mês) e produto com compra em aberto não são julgados. Religando à mão,
              ele só é julgado de novo depois da próxima venda; uma entrada de compra religa sozinha.{" "}
              <strong>Zero desliga a rotina.</strong>
            </p>
          </div>
          <Input
            id="restock-score-cutoff"
            type="number"
            min={0}
            max={100}
            step={1}
            value={restockScoreCutoff}
            onChange={(e) => onRestockScoreCutoffChange(Number(e.target.value))}
            disabled={isSaving}
            className="w-24 text-right"
          />
        </div>
      </CardContent>
    </Card>
  );
}

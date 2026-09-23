import { ClipboardCheck, Ghost, HelpCircle, ListChecks } from "lucide-react";
import type { ProductAnomalyRulesDto } from "@workspace/api-client-react";
import { BiHelpDialog, BiHelpTerm } from "@/components/bi-help-dialog";
import { ANOMALY_ORDER, anomalyMeta } from "../lib/anomalies";

/**
 * O manual da tela. A regra do estoque fantasma é escrita com os números que o
 * servidor devolveu (`rules`) — um texto que ensinasse "3 vendas" enquanto a
 * regra usa outro número ensinaria errado, e envelheceria sem ninguém perceber.
 */
export function AnomaliesHelp({ rules }: { rules: ProductAnomalyRulesDto }) {
  const percentual = Math.round(rules.lowStockEntryShare * 100);

  return (
    <BiHelpDialog
      screen="Anomalias — como ler"
      summary="O que está errado agora no cadastro dos produtos, para corrigir no próprio cadastro e recarregar."
      sections={[
        {
          title: "Como a tela funciona",
          icon: ListChecks,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Cada consulta <strong className="text-foreground/85">varre o catálogo inteiro</strong> e
                mostra só o que está errado neste momento. Nada é gravado: não existe “marcar como resolvido”.
                O produto sai da lista quando a causa é corrigida no cadastro.
              </p>
              <p>
                O link ao lado do nome abre o cadastro em nova aba. Ao voltar para esta aba, a lista se refaz
                sozinha; o botão de recarregar faz o mesmo na hora.
              </p>
              <p>
                <strong className="text-foreground/85">Produto inativo com estoque zerado não aparece</strong>
                : é o fim normal de um produto com que a loja parou de trabalhar.
              </p>
              <p>
                <strong className="text-foreground/85">Preço abaixo do custo só conta com estoque</strong>:
                sem saldo, pode ter sido queima de estoque, e a próxima entrada já pede o preço e mostra a
                margem.
              </p>
            </div>
          ),
        },
        {
          title: "As etiquetas, da mais grave para a menos grave",
          icon: HelpCircle,
          body: (
            <div className="flex flex-col gap-1.5">
              {ANOMALY_ORDER.map((tipo) => (
                <BiHelpTerm key={tipo} term={anomalyMeta(tipo).label}>
                  {anomalyMeta(tipo).fix}
                </BiHelpTerm>
              ))}
              <p className="mt-1">
                Vermelho é o que perde dinheiro ou trava a venda agora; âmbar é o que pede atenção.
              </p>
            </div>
          ),
        },
        {
          title: "Estoque fantasma: como a tela desconfia",
          icon: Ghost,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                Saldo que só existe no sistema não aparece no banco: prateleira vazia não grava nada. O que
                aparece é o <strong className="text-foreground/85">silêncio</strong> — o produto vinha
                vendendo e parou. A etiqueta acende quando as três coisas acontecem juntas:
              </p>
              <ol className="ml-5 list-decimal space-y-1">
                <li>
                  <strong className="text-foreground/85">Saldo baixo</strong>: menos de{" "}
                  {rules.lowStockMinUnits} unidades, ou menos de {percentual}% da última compra — vale o maior
                  dos dois.
                </li>
                <li>
                  <strong className="text-foreground/85">Vinha vendendo</strong>: ao menos{" "}
                  {rules.phantomMinWindowSales} vendas desde a última compra, olhando no máximo{" "}
                  {rules.phantomWindowDays} dias para trás.
                </li>
                <li>
                  <strong className="text-foreground/85">Parou</strong>: no ritmo dele, já teria aparecido em{" "}
                  {rules.phantomMinExpectedSales} vendas da loja, e não apareceu em nenhuma. Se estivesse na
                  prateleira, a chance desse silêncio seria de cerca de 5%.
                </li>
              </ol>
              <p>
                O silêncio é contado em <strong className="text-foreground/85">vendas da loja</strong>, e não
                em dias: domingo e feriado não acusam ninguém, e um sábado cheio pesa mais que uma segunda
                parada.
              </p>
              <p>
                É suspeita, não certeza — a contagem da prateleira decide. A contagem física não entra na
                conta: se ela zerar o saldo, o produto sai da lista; se confirmar o saldo, ele fica até vender
                ou até as unidades serem baixadas.
              </p>
            </div>
          ),
        },
        {
          title: "O que a tela não sabe",
          icon: ClipboardCheck,
          body: (
            <div className="flex flex-col gap-2">
              <p>
                <strong className="text-foreground/85">Custo zero pode ser de propósito</strong>: bonificação
                e brinde entram sem custo. A etiqueta diz de qual entrada vem o zero, e só some quando nenhuma
                unidade da prateleira sair com custo zero e o custo do cadastro deixar de ser zero. Uma compra
                nova por cima NÃO resolve: as unidades antigas continuam saindo primeiro. A tela corrige só a
                última entrada; zero numa entrada anterior se corrige por script.
              </p>
              <p>
                <strong className="text-foreground/85">Queda real de procura parece estoque fantasma</strong>:
                moda que passou, produto de época, produto guardado fora da gôndola. A contagem separa os
                casos.
              </p>
              <p>
                A <strong className="text-foreground/85">Conferência de produtos</strong> (Inventário) é outra
                coisa: a varredura completa, com estado, feita aos poucos. Esta tela é o radar — sem estado,
                só o que está errado agora.
              </p>
            </div>
          ),
        },
      ]}
    />
  );
}

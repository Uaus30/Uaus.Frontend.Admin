import { ArrowRight, Truck } from "lucide-react";
import { Link } from "wouter";
import { useGetPurchasesSummary } from "@workspace/api-client-react";
import { PURCHASES_PATH } from "../purchases-route";

/** "1 compra pendente" / "3 compras pendentes" — e nada quando não há nenhuma. */
function contar(quantidade: number, singular: string, plural: string): string | null {
  if (quantidade <= 0) return null;
  return quantidade === 1 ? `1 compra ${singular}` : `${quantidade} compras ${plural}`;
}

/**
 * Aviso de compras em aberto, com link para a tela de Compras.
 *
 * ## O que ele conta
 *
 * As **não lançadas**: Pendente (anotada, ainda não comprada) e A caminho
 * (comprada, ainda não recebida). É a mesma pergunta da aba que a tela de
 * Compras abre por padrão — "o que ainda está por chegar" —, e por isso o link
 * cai nela sem filtro nenhum. Compra lançada não entra: ela já virou entrada de
 * estoque e não espera mais nada.
 *
 * Os dois números aparecem **separados** porque pedem ações diferentes: a
 * pendente espera alguém COMPRAR, a que está a caminho espera a mercadoria
 * CHEGAR. Somados, o painel diria quanta coisa está aberta sem dizer o que
 * fazer com ela.
 *
 * ## Por que âmbar, e não vermelho
 *
 * Âmbar é "em andamento" no vocabulário de cores da loja
 * (`Uaus.Docs/dominio/convencoes-de-interface.md`); vermelho é "negativo,
 * bloqueado", e é o que o alerta de estoque baixo já usa ao lado deste. Compra
 * em aberto não é problema — é trabalho em curso, e pintá-la de vermelho
 * gastaria a única cor que hoje significa "resolva agora". O ícone e o texto
 * acompanham a cor, porque cor sozinha não informa.
 *
 * Some quando não há nenhuma, como o alerta de estoque baixo: painel com faixa
 * permanente vira moldura, e moldura ninguém lê.
 *
 * É um componente com query própria, e não uma prop da página, pelo mesmo
 * motivo do `LowStockAlert`: o dado é dele, e repetir a consulta no hook de cada
 * tela que o exibisse seria a duplicata que diverge.
 */
export function OpenPurchasesAlert() {
  const { data } = useGetPurchasesSummary();
  const pendentes = data?.pending ?? 0;
  const aCaminho = data?.inTransit ?? 0;

  if (pendentes + aCaminho <= 0) return null;

  const partes = [
    contar(pendentes, "pendente", "pendentes"),
    contar(aCaminho, "a caminho", "a caminho"),
  ].filter((parte): parte is string => parte !== null);

  return (
    <Link
      href={PURCHASES_PATH}
      data-testid="open-purchases-alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 transition-colors hover:bg-amber-500/20"
    >
      <span className="flex items-center gap-2">
        <Truck className="h-4 w-4 shrink-0" />
        <span>
          Existem <strong>{partes.join(" e ")}</strong>. Acompanhe o que ainda está por chegar na tela de
          Compras.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

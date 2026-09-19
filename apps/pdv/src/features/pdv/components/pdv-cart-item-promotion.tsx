import { useState } from "react";
import { Tag, Zap } from "lucide-react";
import { Button } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { PROMOTION_TYPE } from "@workspace/api-client-react";
import { usePdvStore } from "@/stores/use-pdv-store";
import type { PromotionLineInfo } from "@/lib/promotions";
import { ConfirmActionDialog } from "./confirm-action-dialog";

/**
 * O selo da promoção na linha do carrinho.
 *
 * ## Por que ele existe
 *
 * Hoje a loja baixa o preço no CADASTRO do produto quando faz a relâmpago de
 * sábado. O preço promocional some no meio dos outros, ninguém no balcão sabe
 * dizer se aquele item está em promoção, e no fim do dia não sobra nada para
 * medir. Com o selo, o operador vê o cartaz aplicado na linha e consegue
 * responder ao cliente que pergunta.
 *
 * ## A cor segue o vocabulário da casa
 *
 * Verde é "positivo, disponível" e âmbar é "atenção, parcial"
 * (`Uaus.Docs/dominio/convencoes-de-interface.md`). A linha inteira no preço do
 * cartaz é verde; a linha dividida pelo limite — parte promocional, parte a preço
 * normal — é âmbar, que é exatamente o "parcial" do vocabulário.
 *
 * **Relâmpago e Dia a Dia não trocam de cor**: inventar uma quinta cor quebraria
 * os quatro significados que o resto do sistema usa. O que os separa é a palavra
 * e o ícone — raio para a relâmpago, etiqueta para a do dia a dia —, e é também o
 * que faz a informação sobreviver em preto e branco e para quem não distingue as
 * duas cores.
 */

type PdvCartItemPromotionChipProps = {
  /** A promoção que alcançou esta linha, ou `undefined` quando não houve. */
  info?: PromotionLineInfo;
  /** Nome do produto, usado no aviso da liberação. */
  productName: string;
};

export function PdvCartItemPromotionChip({ info, productName }: PdvCartItemPromotionChipProps) {
  const togglePromotionLimit = usePdvStore((state) => state.togglePromotionLimit);
  const [confirmarLiberacao, setConfirmarLiberacao] = useState(false);

  if (!info) return null;

  const relampago = info.type === PROMOTION_TYPE.Flash;
  const parcial = info.regularQuantity > 0;

  // Âmbar quando o limite dividiu a linha; verde quando o cartaz valeu para tudo.
  const tom = parcial
    ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

  const Icone = relampago ? Zap : Tag;

  return (
    <div className={`mt-2 flex items-center justify-between gap-2 rounded-md border px-2 py-1 ${tom}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <Icone className="h-3 w-3 shrink-0" />
        <span className="shrink-0 text-[10px] font-bold uppercase">
          {relampago ? "Relâmpago" : "Promoção"}
        </span>
        <span className="text-[10px] font-semibold">− {formatCurrency(info.unitDiscount)} por unidade</span>

        {/* A divisão do limite é dita em unidades, e não em reais: é assim que o
            cartaz fala ("limite de 6 copos por cliente") e é o que o operador
            precisa repetir para o cliente que pegou dez. */}
        {parcial && (
          <span className="min-w-0 text-[10px] text-muted-foreground">
            {info.promotionalQuantity} de {info.promotionalQuantity + info.regularQuantity} no preço
            promocional · limite de {info.maxQuantityPerSale} por cliente
          </span>
        )}

        {!parcial && info.maxQuantityPerSale != null && (
          <span className="min-w-0 text-[10px] text-muted-foreground">
            {info.released
              ? "limite liberado nesta venda"
              : `limite de ${info.maxQuantityPerSale} por cliente`}
          </span>
        )}
      </div>

      {/* Liberar aparece só com excedente — liberar um limite que ninguém alcançou
          não faria nada e viraria ruído em toda linha promocional. Retravar
          aparece só depois de liberado, e é o caminho de volta: sem ele, um toque
          errado numa tela de balcão só teria saída cancelando a venda inteira. */}
      {parcial && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 shrink-0 px-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400"
          onClick={() => setConfirmarLiberacao(true)}
          aria-label={`Liberar o limite da promoção de ${productName}`}
        >
          Liberar limite
        </Button>
      )}

      {info.released && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 shrink-0 px-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground"
          onClick={() => togglePromotionLimit(info.promotionId)}
          aria-label={`Voltar a aplicar o limite da promoção de ${productName}`}
        >
          Retravar
        </Button>
      )}

      {/* A pergunta nomeia o produto e as quantidades porque é a convenção da casa
          para o que muda dinheiro (`Uaus.Docs/dominio/convencoes-de-interface.md`)
          — e porque "tem certeza?" obrigaria o operador a lembrar em qual das
          linhas do carrinho ele tocou. */}
      <ConfirmActionDialog
        open={confirmarLiberacao}
        onOpenChange={setConfirmarLiberacao}
        title="Liberar o limite desta promoção?"
        description={
          <>
            As {info.regularQuantity} unidade(s) de <strong>{productName}</strong> que estão fora do limite
            passam a sair pelo preço promocional nesta venda, somando{" "}
            {info.promotionalQuantity + info.regularQuantity}. O limite de {info.maxQuantityPerSale} por
            cliente continua valendo para os próximos, e a liberação fica registrada.
          </>
        }
        confirmLabel="Liberar"
        onConfirm={() => togglePromotionLimit(info.promotionId)}
      />
    </div>
  );
}

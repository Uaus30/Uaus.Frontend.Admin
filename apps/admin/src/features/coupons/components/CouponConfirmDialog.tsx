import { ConfirmDialog } from "@workspace/ui";
import type { CouponConfirm, CouponConfirmContent } from "../types";

/**
 * Textos de cada confirmação.
 *
 * Todos citam **quantos resgates** o cupom tem. Sem o número, "tem certeza?" não
 * distingue mexer num cupom que ninguém usou de mexer num que já saiu em 143
 * comprovantes impressos — e a segunda decisão é a que muda o que o panfleto na
 * rua promete.
 */
function describeConfirm(request: CouponConfirm): CouponConfirmContent {
  const { coupon } = request;
  const resgates = coupon.redeemedCount === 1 ? "1 resgate" : `${coupon.redeemedCount} resgates`;

  if (request.kind === "excluir") {
    return {
      title: "Excluir este cupom?",
      itemName: coupon.code,
      description:
        "O cupom sai do cadastro. A exclusão só existe enquanto ele nunca foi usado — depois do primeiro resgate o caminho passa a ser desativar.",
      confirmLabel: "Sim, excluir",
      destructive: true,
    };
  }

  if (request.kind === "desativar") {
    return {
      title: "Desativar este cupom?",
      itemName: coupon.code,
      description: `Ele para de valer no balcão imediatamente. Tem ${resgates} e por isso continua no cadastro: o relatório da campanha e os comprovantes já impressos dependem dessa linha.`,
      confirmLabel: "Sim, desativar",
      destructive: false,
    };
  }

  return {
    title: "Alterar um cupom que já foi resgatado?",
    itemName: coupon.code,
    description: `Este cupom tem ${resgates}. As vendas passadas não mudam — cada resgate guarda o próprio retrato do cupom —, mas o panfleto que está na rua passa a valer diferente a partir de agora.`,
    confirmLabel: "Sim, alterar",
    destructive: false,
  };
}

interface CouponConfirmDialogProps {
  /** Pedido pendente vindo do hook. Null = nenhum diálogo aberto. */
  request: CouponConfirm | null;
  onAccept: () => void;
  onDismiss: () => void;
  /** Mutação em voo — trava o botão para o duplo clique não sair duas vezes. */
  loading: boolean;
}

/** Diálogo único das três decisões destrutivas da tela de cupons. */
export function CouponConfirmDialog({ request, onAccept, onDismiss, loading }: CouponConfirmDialogProps) {
  const content = request ? describeConfirm(request) : null;

  return (
    <ConfirmDialog
      open={request !== null}
      onOpenChange={(open) => !open && onDismiss()}
      title={content?.title ?? ""}
      itemName={content?.itemName}
      description={content?.description ?? ""}
      confirmLabel={content?.confirmLabel}
      destructive={content?.destructive}
      loading={loading}
      onConfirm={onAccept}
    />
  );
}

import { useState } from "react";
import { Barcode, ChevronDown } from "lucide-react";
import { Button, Input } from "@workspace/ui";
import { resolveBarcodeInput } from "@workspace/core";
import type { PurchaseFormItem } from "../types";

type PurchaseReceiveBarcodeChangesProps = {
  /** As linhas da conferência; só as que já têm cadastro aceitam troca. */
  items: PurchaseFormItem[];
  /** O código novo digitado, por `productId`. */
  changes: Record<number, string>;
  onChange: (productId: number, value: string) => void;
  /**
   * Abre já expandido — quando as instruções de recebimento falam de código, o
   * operador não precisa procurar o botão.
   */
  defaultOpen?: boolean;
};

/**
 * "Código de barras mudou?" no recebimento (22/10/2026, decisão do dono).
 *
 * O fabricante trocou o código da embalagem: quem recebe bipa o novo na variação.
 * Sem venda, o código é só trocado no cadastro. Com venda, o cadastro fica com o
 * código antigo — e com o estoque e as vendas dele — como a variação de marca
 * M1 (M2…), e as unidades desta compra entram numa variação nova, com o código
 * novo e sem marca. O texto diz isso antes de confirmar, porque o efeito aparece
 * em outra tela (a de Produtos).
 *
 * Fechado por padrão: é exceção, e a conferência já é uma tela cheia.
 */
export function PurchaseReceiveBarcodeChanges({
  items,
  changes,
  onChange,
  defaultOpen = false,
}: PurchaseReceiveBarcodeChangesProps) {
  // Só as que vieram: a que ficou com zero não tem embalagem nova para bipar.
  const cadastradas = items.filter((item) => item.productId > 0 && item.quantity > 0);
  const [aberto, setAberto] = useState(defaultOpen);
  if (cadastradas.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/40">
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
      >
        <span className="flex items-center gap-2">
          <Barcode className="h-4 w-4 text-muted-foreground" /> Código de barras mudou?
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </Button>

      {aberto && (
        <div className="space-y-3 border-t border-border/40 px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Bipe o código novo da embalagem. Se o código atual ainda não vendeu, ele é só trocado. Se já
            vendeu, o cadastro atual fica com ele (e com o estoque) como a variação de marca{" "}
            <span className="font-semibold">M1</span> (M2, M3… nas trocas seguintes), e estas unidades entram
            numa variação nova, com o código novo e sem marca.
          </p>
          {cadastradas.map((item) => {
            const digitado = changes[item.productId] ?? "";
            const resolvido = digitado.trim() ? resolveBarcodeInput(digitado) : null;
            return (
              <div
                key={item.productId}
                className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_14rem] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Atual: {item.barcode || "sem código"}
                  </p>
                </div>
                <div>
                  <Input
                    value={digitado}
                    onChange={(event) => onChange(item.productId, event.target.value)}
                    inputMode="numeric"
                    placeholder="Código novo"
                    aria-label={`Código novo de ${item.name}`}
                    aria-invalid={resolvido?.kind === "invalid"}
                    className={`h-9 bg-background font-mono ${resolvido?.kind === "invalid" ? "border-red-500" : ""}`}
                  />
                  {resolvido?.kind === "invalid" && (
                    <p className="mt-1 text-xs font-medium text-red-500">{resolvido.error}</p>
                  )}
                  {resolvido?.kind === "internal" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Será gravado como <span className="font-mono">{resolvido.code}</span>.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { HelpCircle } from "lucide-react";
import Barcode from "react-barcode";
import { Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui";
import { resolveBarcodeFormat, resolveBarcodeInput } from "@workspace/core";

type PurchaseBarcodeFieldProps = {
  value: string;
  readOnly: boolean;
  /** A consulta ao catálogo está em voo. */
  searching: boolean;
  onChange: (value: string) => void;
  /** Enter (o fim do bipe) ou saída do campo: procura o código na hora. */
  onCommit: (value: string) => void;
};

/**
 * O código de barras do produto a comprar, quando ele ainda não está vinculado
 * (24/09/2026). Opcional.
 *
 * Segue o campo do cadastro de produto: a mesma regra de conversão
 * (`resolveBarcodeInput` — 13 dígitos da embalagem, ou até 11 para o código
 * interno), a mesma prévia do código que vai ser GRAVADO e as mesmas mensagens.
 * A diferença é o que acontece com um código que já tem dono: lá ele carrega o
 * produto na tela; aqui ele vincula a compra ao produto, pelo campo "Produto já
 * cadastrado". Código novo fica na compra e é com ele que o cadastro do
 * recebimento nasce.
 *
 * Não tem o botão de imprimir etiqueta do cadastro: o produto ainda não existe.
 */
export function PurchaseBarcodeField({
  value,
  readOnly,
  searching,
  onChange,
  onCommit,
}: PurchaseBarcodeFieldProps) {
  const resolvido = resolveBarcodeInput(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <label htmlFor="purchase-barcode" className="text-xs font-semibold uppercase text-muted-foreground">
          Código de barras
        </label>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger type="button" tabIndex={-1}>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>
                Informe os 13 dígitos impressos na embalagem, até 11 dígitos para gerar um código interno com
                esse número dentro, ou deixe vazio. Código de um produto já cadastrado vincula a compra a ele.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-4">
        <Input
          id="purchase-barcode"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit(event.target.value)}
          onKeyDown={(event) => {
            // O leitor termina o bipe com Enter. Quem impede o Enter de gravar a
            // compra é o formulário; aqui ele só antecipa a consulta.
            if (event.key === "Enter") onCommit(event.currentTarget.value);
          }}
          inputMode="numeric"
          aria-invalid={resolvido.kind === "invalid"}
          className={`h-10 flex-1 bg-background font-mono ${
            resolvido.kind === "invalid"
              ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500"
              : ""
          }`}
          placeholder="Ex: 7891234567890"
          readOnly={readOnly}
        />
        <div
          data-testid="purchase-barcode-preview"
          className={`flex min-h-[46px] min-w-[120px] items-center justify-center rounded border bg-white px-2 py-1 text-center ${
            resolvido.code ? "opacity-100" : "opacity-40 grayscale"
          }`}
        >
          {resolvido.code ? (
            <Barcode
              value={resolvido.code}
              format={resolveBarcodeFormat(resolvido.code)}
              height={30}
              width={1.5}
              fontSize={12}
              margin={0}
              background="transparent"
            />
          ) : (
            <span className="text-xs text-muted-foreground">Sem prévia</span>
          )}
        </div>
      </div>
      {resolvido.error ? (
        <p className="text-xs font-medium text-red-500">{resolvido.error}</p>
      ) : searching ? (
        <p className="text-xs text-muted-foreground">Procurando o código no catálogo...</p>
      ) : resolvido.kind === "internal" ? (
        // Dizer o número que será gravado evita a surpresa de digitar "20" e
        // encontrar "2000000000206" no cadastro depois.
        <p className="text-xs text-muted-foreground">
          Será gravado como <span className="font-mono">{resolvido.code}</span>, da faixa interna da loja.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Opcional. Código já cadastrado vincula a compra ao produto; código novo vai para o cadastro no
          recebimento.
        </p>
      )}
    </div>
  );
}

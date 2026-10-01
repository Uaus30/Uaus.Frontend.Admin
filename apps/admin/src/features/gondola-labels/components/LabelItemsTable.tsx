import { Eraser, Printer, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { LABEL_NAME_MAX_LENGTH, LABEL_TYPE_INFOS, type LabelDraftItem, type LabelTypeCode } from "../types";
import { DraftStatus, type DraftStatusProps } from "./DraftStatus";

interface LabelItemsTableProps {
  items: LabelDraftItem[];
  description: string;
  setDescription: (value: string) => void;
  totalLabels: number;
  totalProducts: number;
  printing: boolean;
  canGenerate: boolean;
  /** A lista ainda não aceita alteração (o rascunho salvo está sendo lido). */
  disabled: boolean;
  draft: DraftStatusProps;
  onUpdate: (index: number, patch: Partial<LabelDraftItem>) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onGenerate: () => void;
}

/** Bolinha com a cor de fundo do tipo, usada nas opções do select. */
function TypeDot({ background }: { background: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
      style={{ background }}
    />
  );
}

/**
 * Colunas da linha no computador. No celular a mesma linha vira um cartão: nome
 * em cima, tipo/preço/cópias embaixo. Uma marcação só para os dois, em vez de
 * tabela + lista — duas versões da mesma linha divergem na primeira mudança.
 */
const ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_11rem_6rem_4rem_2rem] md:items-start md:gap-3";

/**
 * Lista editável das etiquetas do lote: nome impresso, tipo, preço e cópias por
 * produto.
 *
 * Responsiva desde 30/09/2026: a lista passou a ser montada no celular, lendo o
 * código pela câmera na frente da prateleira. A tabela de cinco colunas de
 * largura fixa obrigava a rolar de lado para achar a quantidade e a lixeira.
 */
export function LabelItemsTable({
  items,
  description,
  setDescription,
  totalLabels,
  totalProducts,
  printing,
  canGenerate,
  disabled,
  draft,
  onUpdate,
  onRemove,
  onClear,
  onGenerate,
}: LabelItemsTableProps) {
  return (
    <Card className="border-border/50 shadow-lg shadow-black/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Etiquetas do Lote</CardTitle>
        <CardDescription>
          Defina o nome, o tipo, o preço impresso e as cópias de cada etiqueta. A lista se salva sozinha.
        </CardDescription>
        <DraftStatus {...draft} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input
          placeholder="Identificação do lote (opcional) — ex.: Promoção da semana"
          value={description}
          disabled={disabled}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={150}
          className="bg-background"
        />

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
            Busque e adicione produtos para montar o lote de etiquetas.
          </p>
        ) : (
          <div className="rounded-xl border border-border/50 text-sm">
            <div
              className={`hidden bg-muted/30 px-3 py-2 text-xs font-medium uppercase text-muted-foreground ${ROW_GRID}`}
            >
              <span>Nome impresso</span>
              <span>Tipo</span>
              <span className="text-right">Preço (R$)</span>
              <span className="text-center">Cópias</span>
              <span />
            </div>
            <ul className="divide-y divide-border/50">
              {items.map((item, index) => (
                <li
                  key={`${item.productId}-${item.labelType}`}
                  className={`flex flex-col gap-2 p-3 ${ROW_GRID}`}
                >
                  <div className="min-w-0">
                    {/* Editável: o nome do cadastro nem sempre cabe na gôndola —
                        "COPO AMERICANO [ORIGINAL]" vira "COPO AMERICANO". Vazio
                        volta para o nome do cadastro, que é o placeholder. */}
                    <Input
                      value={item.productName}
                      maxLength={LABEL_NAME_MAX_LENGTH}
                      placeholder={item.catalogName}
                      title="Nome que sai impresso na etiqueta"
                      aria-label="Nome impresso"
                      disabled={disabled}
                      onChange={(event) => onUpdate(index, { productName: event.target.value })}
                      className="h-9 w-full bg-background font-medium md:h-8"
                    />
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.barcode ?? "Sem código de barras"}
                    </p>
                  </div>

                  {/* No celular: tipo numa linha inteira, e preço, cópias e a
                      lixeira na de baixo. Tudo numa linha só não cabe: em 375px
                      o select do tipo ficava sem largura nenhuma. Cada campo
                      tem rótulo próprio porque o cabeçalho some. */}
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-end gap-2 md:contents">
                    <label className="col-span-3 flex min-w-0 flex-col gap-1 md:col-span-1 md:block">
                      <span className="text-[11px] text-muted-foreground md:hidden">Tipo</span>
                      <Select
                        value={String(item.labelType)}
                        disabled={disabled}
                        onValueChange={(value) =>
                          onUpdate(index, { labelType: Number(value) as LabelTypeCode })
                        }
                      >
                        <SelectTrigger
                          className="h-9 w-full bg-background md:h-8"
                          aria-label="Tipo de etiqueta"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LABEL_TYPE_INFOS.map((info) => (
                            <SelectItem key={info.code} value={String(info.code)}>
                              <span className="flex items-center gap-2">
                                <TypeDot background={info.background} />
                                {info.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 md:block">
                      <span className="text-[11px] text-muted-foreground md:hidden">Preço (R$)</span>
                      <Input
                        value={item.priceInput}
                        inputMode="decimal"
                        aria-label="Preço impresso"
                        disabled={disabled}
                        onChange={(event) => onUpdate(index, { priceInput: event.target.value })}
                        className="h-9 w-full bg-background text-right md:h-8"
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 md:block">
                      <span className="text-[11px] text-muted-foreground md:hidden">Cópias</span>
                      <Input
                        value={item.quantityInput}
                        inputMode="numeric"
                        aria-label="Cópias"
                        disabled={disabled}
                        onChange={(event) => onUpdate(index, { quantityInput: event.target.value })}
                        className="h-9 w-full bg-background text-center md:h-8"
                      />
                    </label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive md:h-8 md:w-8"
                      title="Remover do lote"
                      aria-label={`Remover ${item.productName || item.catalogName} do lote`}
                      disabled={disabled}
                      onClick={() => onRemove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {totalProducts} produto(s) · {totalLabels} etiqueta(s)
          </p>
          <div className="flex gap-2">
            {/* Limpar zera lote, identificação e o rascunho salvo: depois de
                imprimir, é o único caminho para recomeçar — a tela não se
                esvazia sozinha. */}
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={(items.length === 0 && !description.trim()) || printing || disabled}
              onClick={onClear}
            >
              <Eraser className="mr-2 h-4 w-4" /> Limpar
            </Button>
            <Button
              type="button"
              className="hover-elevate flex-1 sm:flex-none"
              disabled={!canGenerate}
              onClick={onGenerate}
            >
              {printing ? <Spinner className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />}
              Salvar e Imprimir
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { Input } from "@workspace/ui";
import { Switch } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui";
import { HelpCircle, Settings } from "lucide-react";
import { TagMultiSelect } from "@/components/tag-multi-select";
import { formatShortDate } from "@workspace/core";
import { STOCK_SETTINGS_PATH } from "@/lib/stock-control";
import type { useProductEditor } from "../../hooks/useProductEditor";
import { useProductForEntry } from "../../hooks/useProductForEntry";
import { ProductStockControlField } from "./ProductStockControlField";

type ProductOptionalFieldsProps = {
  editor: ReturnType<typeof useProductEditor>;
};

/**
 * Campos que o cadastro do dia a dia não preenche: descrição, etiquetas,
 * estoque mínimo, visibilidade no site, controle de estoque e observações
 * internas.
 *
 * Ficavam atrás do botão de olho da modal, depois numa aba **Opcionais** (de
 * 30/08 a 04/10/2026) e hoje voltam para a aba **Dados**, atrás do botão "Mais
 * campos" abaixo de preço e status (`ProductGeneralTab`). A aba obrigava a
 * trocar de tela para mexer no mínimo e no controle de estoque, que é o ajuste
 * mais frequente daqui (relato do dono). O "Estoque atual" que existia aqui saiu:
 * era o mesmo número do campo da aba Dados.
 *
 * Abaixo do estoque mínimo, a **última compra** ("comprei 3, o mínimo é 1"), do
 * mesmo jeito que a margem aparece abaixo do preço. Só no produto simples: no
 * grupo com variações o mínimo daqui não vale, cada variação tem o seu.
 *
 * Estoque mínimo e visibilidade são do PRODUTO representante e do GRUPO,
 * respectivamente. Num grupo com variações o estoque mínimo daqui não é usado:
 * cada variação tem o seu, salvo pela tabela de variações.
 *
 * <b>Observações é o único campo de USO INTERNO.</b> Todos os outros — mesmo
 * "escondidos" nesta aba — acabam visíveis em algum lugar público (descrição
 * compõe a busca e a vitrine, etiqueta aparece no card do site). Observações
 * não sai daqui nem entra na busca: quando preenchida, o único outro lugar
 * onde ela aparece é o alerta no topo da aba Dados (`ProductNotesAlert`).
 */
export function ProductOptionalFields({ editor }: ProductOptionalFieldsProps) {
  const { form, setForm, productEditor, setProductEditor, tags, registerTag, stockControl } = editor;
  // A mesma consulta de "Último custo" e da margem: uma requisição só.
  const { data: product } = useProductForEntry(form.hasVariations ? null : (productEditor.id ?? null));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Descrição</label>
          <Input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            className="bg-background"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Tags</label>
          <TagMultiSelect
            allTags={tags}
            selectedIds={productEditor.tagIds}
            onChange={(tagIds) => setProductEditor((current) => ({ ...current, tagIds }))}
            onTagCreated={registerTag}
            placeholder="Selecione ou crie uma nova tag"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <label className="text-sm font-medium">Estoque mínimo</label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger type="button" tabIndex={-1}>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Com o saldo igual ou abaixo deste número, o produto entra no relatório de estoque baixo.
                      Vazio usa o mínimo padrão da loja ({stockControl.defaultMinStock}), definido em
                      Configurações. Preencha só para o produto que pede outro número.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {/*
                O padrão mora nas Configurações, e o caminho até lá fica no próprio
                campo: quem estranha o número vazio acha onde ele é definido. Em
                NOVA aba: trocar de página aqui desmontaria o cadastro aberto e
                perderia o que foi digitado, sem a pergunta de descartar.
              */}
              <a
                href={STOCK_SETTINGS_PATH}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
                title="Abrir as Configurações de estoque"
              >
                <Settings className="h-3 w-3" />
                Padrão: {stockControl.defaultMinStock}
              </a>
            </div>
            <Input
              type="number"
              min="0"
              // Zero é "usa o padrão": mostrar 0 no campo leria como "mínimo zero".
              value={productEditor.minStock > 0 ? productEditor.minStock : ""}
              placeholder={`Padrão da loja (${stockControl.defaultMinStock})`}
              onChange={(event) =>
                setProductEditor((current) => ({
                  ...current,
                  minStock: Math.max(0, Number(event.target.value) || 0),
                }))
              }
              className="bg-background"
            />
            {product?.lastPurchaseQuantity != null && (
              <p
                className="text-xs text-muted-foreground"
                title="A última entrada de compra deste produto. Ajuda a escolher o mínimo: comprou 3, o mínimo pode ser 1."
              >
                Última compra:{" "}
                <span className="font-semibold text-foreground">{product.lastPurchaseQuantity} un</span>
                {product.lastPurchaseDate ? ` em ${formatShortDate(product.lastPurchaseDate)}` : ""}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Visibilidade</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer border border-border/50 rounded-md px-3 h-10 bg-card hover:bg-muted/50 transition-colors w-full justify-between">
              <span className="font-medium shrink-0">Exibir no site</span>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isPublic: checked === true }))
                }
              />
            </label>
          </div>
        </div>

        <ProductStockControlField stockControl={stockControl} hasVariations={form.hasVariations} />

        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium">Observações</label>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger type="button" tabIndex={-1}>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Uso interno da equipe. Nunca aparece no site nem no PDV.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Ex.: fornecedor demora para repor, combinar troca por WhatsApp..."
            rows={3}
            className="bg-background"
          />
        </div>
      </div>
    </div>
  );
}

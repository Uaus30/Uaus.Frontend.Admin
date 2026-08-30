import { Input } from "@workspace/ui";
import { Switch } from "@workspace/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui";
import { HelpCircle } from "lucide-react";
import { TagMultiSelect } from "@/components/tag-multi-select";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductOptionalFieldsProps = {
  editor: ReturnType<typeof useProductEditor>;
};

/**
 * Campos que o cadastro do dia a dia não preenche: descrição, etiquetas,
 * estoque mínimo, estoque atual e visibilidade no site.
 *
 * Ficavam escondidos atrás do botão de olho da modal. O olho tinha um problema
 * que a aba resolve: nada na tela dizia que existiam cinco campos ali dentro —
 * quem não conhecia o ícone nunca marcava "exibir no site", e o produto não
 * aparecia na loja sem ninguém entender por quê.
 *
 * Estoque mínimo e visibilidade são do PRODUTO representante e do GRUPO,
 * respectivamente. Num grupo com variações o estoque mínimo daqui não é usado:
 * cada variação tem o seu, salvo pela tabela de variações.
 */
export function ProductOptionalFields({ editor }: ProductOptionalFieldsProps) {
  const { form, setForm, productEditor, setProductEditor, tags, registerTag } = editor;

  return (
    <div className="space-y-6 rounded-2xl border border-border/50 bg-background/40 p-5">
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:col-span-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <label className="text-sm font-medium">Estoque mínimo</label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger type="button" tabIndex={-1}>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Defina um valor maior que zero para controlar o estoque deste produto.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="number"
              min="0"
              value={productEditor.minStock}
              onChange={(event) =>
                setProductEditor((current) => ({ ...current, minStock: Number(event.target.value) }))
              }
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <label className="text-sm font-medium">Estoque atual</label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger type="button" tabIndex={-1}>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calculado automaticamente com base nas entradas de estoque.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="number"
              value={productEditor.stock}
              readOnly
              className="bg-muted/30 text-muted-foreground cursor-not-allowed"
            />
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
      </div>
    </div>
  );
}

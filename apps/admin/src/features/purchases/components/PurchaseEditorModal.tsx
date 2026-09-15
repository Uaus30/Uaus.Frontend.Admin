import { Lock, Package, ShoppingCart, X } from "lucide-react";
import { Button, Input, Textarea } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { DatePicker, formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { PURCHASE_STATUS, type DepartmentDto, type SupplierDto } from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { PricingPreview } from "@/features/stock-entries/components/PricingPreview";
import { ProductSearchPicker } from "@/components/product-search-picker";
import { derivePurchaseTotals } from "../lib/purchase-totals";
import { purchaseHasProduct } from "../hooks/usePurchaseForm";
import { PurchaseDerivedTotals } from "./PurchaseDerivedTotals";
import { PurchaseVariationsGrid } from "./PurchaseVariationsGrid";
import { PurchaseImagesField } from "./PurchaseImagesField";
import { PurchaseLinkField } from "./PurchaseLinkField";
import { PurchaseProductLinkDialog } from "./PurchaseProductLinkDialog";
import type { usePurchaseForm } from "../hooks/usePurchaseForm";

type PurchaseEditorModalProps = {
  form: ReturnType<typeof usePurchaseForm>;
  suppliers: SupplierDto[];
  departments: DepartmentDto[];
};

/**
 * Formulário da compra.
 *
 * O produto é opcional de propósito: a compra costuma ser de algo que ainda
 * não está no cadastro. Sem produto vinculado, nome, detalhes, fotos e link
 * viram o pré-cadastro que o recebimento abre preenchido. Com produto, o nome
 * é o do cadastro e fica travado — duas grafias do mesmo item confundiriam
 * mais do que ajudam.
 *
 * Só os TOTAIS são digitados. Unitários e percentual saem da conta na hora
 * (`derivePurchaseTotals`) e são gravados pelo backend com a mesma fórmula.
 *
 * Pendente aceita só o essencial: fornecedor, produto (ou nome), quantidade e
 * data. O total final vira obrigatório ao sair de Pendente — é dele que sai o
 * custo da entrada —, e o asterisco acompanha a situação escolhida, como o do
 * link em marketplace.
 *
 * **As fotos são a galeria do GRUPO escolhido** (13/09/2026): escolher um
 * produto já cadastrado carrega as fotos dele, e remover ou acrescentar aqui
 * remove ou acrescenta no produto quando a compra é salva. Em produto novo elas
 * ficam só na compra e viram a galeria do cadastro no recebimento.
 *
 * **Departamento e categoria** vêm junto do produto escolhido, travados — quem
 * edita a categoria de um produto é a tela de Produtos. Sem cadastro, eles são
 * obrigatórios: é com eles que o recebimento gera o produto já preenchido.
 *
 * A colagem de foto (Ctrl+V) é escutada pelo DIÁLOGO inteiro, e não por uma
 * área de arrastar: o atalho existe para poupar o clique, e obrigar a acertar
 * um alvo antes de colar devolveria o clique que ele economiza. Quem cola
 * dentro de um campo de texto continua colando texto — o handler se afasta.
 *
 * **Fechar com algo digitado pergunta antes** (15/09/2026), como a tela de
 * produto. O clique no fundo fechava a modal e levava o formulário inteiro
 * junto; quem digita fornecedor, quantidade, totais e sobe foto perde tudo por
 * um clique de dois pixels fora da caixa. Quem decide se há o que perder é o
 * `dirty` do `usePurchaseForm` — compra aberta só para consultar fecha direto.
 */
export function PurchaseEditorModal({ form, suppliers, departments }: PurchaseEditorModalProps) {
  const { form: values, update, readOnly, linkRequired, costRequired, categoryLocked } = form;
  const derived = derivePurchaseTotals(values.quantity, values.grossTotal, values.finalTotal);
  // Com variações o cabeçalho não aponta para nenhuma delas: quem diz que a
  // compra tem produto é o GRUPO. Ver `purchaseHasProduct`.
  const temProduto = purchaseHasProduct(values);

  return (
    // Todo caminho de FECHAR passa pelo `onOpenChange` do Radix — o clique no
    // fundo, o Esc e o X do canto —, então é aqui que a pergunta de descartar
    // se planta uma vez só. Abrir continua direto.
    <Dialog open={form.open} onOpenChange={(aberto) => (aberto ? form.setOpen(true) : form.requestClose())}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        onPaste={readOnly ? undefined : form.handlePaste}
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {readOnly ? "Compra lançada" : form.editingId ? "Editar compra" : "Registrar compra"}
          </DialogTitle>
          <DialogDescription>
            Um produto por compra, com as variações dele. O recebimento vira uma entrada de estoque com as
            quantidades e o custo daqui.
          </DialogDescription>
        </DialogHeader>

        {readOnly && (
          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Esta compra já foi lançada no estoque e não pode mais ser alterada — a entrada existe, e mudar
              quantidade ou valor aqui deixaria os dois documentos discordando. Para corrigir, edite a entrada
              de estoque correspondente.
            </span>
          </div>
        )}

        <form onSubmit={form.submit} className="mt-2 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Fornecedor <span className="text-red-500">*</span>
              </label>
              <Select
                value={values.supplierId}
                onValueChange={(value) => update("supplierId", value)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Selecione um fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={String(supplier.id)}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Data da compra <span className="text-red-500">*</span>
              </label>
              {/* Nasce hoje e é editável: o pedido costuma ser lançado no sistema
                  depois de fechado, e a data do extrato é a que interessa. Não é
                  a data da ENTRADA, que o recebimento pergunta à parte. */}
              <DatePicker
                value={parseDateInput(values.purchaseDate)}
                onChange={(date) => update("purchaseDate", formatDateInput(date))}
                placeholder="Selecionar data"
                clearable={false}
                maxDate={new Date()}
                disabled={readOnly}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Situação</label>
              <Select
                value={values.status}
                onValueChange={(value) => update("status", value)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(PURCHASE_STATUS.Pending)}>Pendente</SelectItem>
                  <SelectItem value={String(PURCHASE_STATUS.InTransit)}>A caminho</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pendente pode ficar sem custo; ele é exigido ao marcar como a caminho.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Produto já cadastrado (opcional)
            </label>
            {!temProduto ? (
              <ProductSearchPicker
                onSelect={form.selectProduct}
                selectedIds={[]}
                disabled={form.isSaving || readOnly}
                placeholder="Buscar produto por nome ou código de barras — ou deixe em branco para produto novo"
              />
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Package className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{values.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {form.hasGrid ? (
                        <span className="font-sans">
                          Produto com variações — escolha as quantidades abaixo
                        </span>
                      ) : (
                        values.productBarcode || "Sem código de barras"
                      )}
                    </p>
                  </div>
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={form.clearProduct}
                    aria-label="Desvincular produto"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {!temProduto && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Nome do produto <span className="text-red-500">*</span>
              </label>
              {/* Caixa alta ao digitar, como o nome no editor de produto: nome de
                  produto é sempre em maiúsculas, e o backend grava assim de qualquer
                  jeito (`ProductDisplayName.Normalize`). Ver o que vai ser gravado
                  evita a surpresa de salvar "Carrinho" e ver "CARRINHO" na lista. */}
              <Input
                value={values.productName}
                onChange={(event) => update("productName", event.target.value.toUpperCase())}
                placeholder="COMO VAI SE CHAMAR NO CADASTRO"
                className="h-10 bg-background uppercase"
                maxLength={150}
                readOnly={readOnly}
              />
            </div>
          )}

          {/* Departamento e categoria do que está sendo comprado.
              Com produto vinculado vêm do cadastro e ficam travados — a categoria
              de um produto se edita na tela de Produtos, e mudá-la por efeito
              colateral de salvar uma compra é o tipo de coisa que só aparece
              quando o item some do filtro da vitrine. Sem cadastro são
              obrigatórios: é com eles que o recebimento gera o produto pronto. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Departamento {!categoryLocked && <span className="text-red-500">*</span>}
              </label>
              <Select
                value={values.departmentId}
                onValueChange={form.setDepartment}
                disabled={readOnly || categoryLocked}
              >
                <SelectTrigger className="h-10 bg-background" aria-label="Departamento">
                  <SelectValue placeholder="Selecione um departamento..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={String(department.id)}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Categoria {!categoryLocked && <span className="text-red-500">*</span>}
              </label>
              <Select
                value={values.categoryId}
                onValueChange={(value) => update("categoryId", value)}
                disabled={readOnly || categoryLocked}
              >
                <SelectTrigger className="h-10 bg-background" aria-label="Categoria">
                  <SelectValue placeholder="Selecione uma categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {form.categories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {categoryLocked
                  ? "Vem do cadastro do produto. Para trocar, edite o produto."
                  : "O produto vai ser cadastrado com este departamento e esta categoria no recebimento."}
              </p>
            </div>
          </div>

          {/* Produto com variações troca o campo de quantidade por uma GRADE: é
              a mesma compra, só que dizendo quanto de cada cor. Produto simples
              — a esmagadora maioria — continua com o campo de sempre, porque o
              caso raro não podia deixar o comum mais trabalhoso. */}
          {form.hasGrid && (
            <PurchaseVariationsGrid
              items={values.items}
              costSplitManual={values.costSplitManual}
              readOnly={readOnly}
              loading={form.isLoadingVariations}
              onQuantityChange={form.setItemQuantity}
              onTotalChange={(productId, valor) => form.setItemTotal(productId, "finalTotal", valor)}
              onToggleManual={form.setCostSplitManual}
            />
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Quantidade {!form.hasGrid && <span className="text-red-500">*</span>}
              </label>
              {/* Zero é o campo EM BRANCO, como no `CurrencyInput`. Com `value={0}` o
                  React escreve "0" no campo assim que o operador apaga tudo, e o que
                  ele digita em seguida entra à direita do zero — "020". Quem recusa
                  quantidade zero é a validação do submit, não o campo. */}
              <Input
                type="number"
                min="1"
                step="1"
                value={values.quantity > 0 ? values.quantity : ""}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  update("quantity", Number.isFinite(parsed) ? parsed : 0);
                }}
                aria-label="Quantidade comprada"
                className="h-10 bg-background"
                readOnly={readOnly || form.hasGrid}
              />
              {form.hasGrid && <p className="text-xs text-muted-foreground">Soma da grade.</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Total bruto</label>
              {/* `allowFormula`: a nota do fornecedor vem em "12 a 17,99", e a conta
                  digitada no campo deixa o total conferível. Ver `evaluateAmountFormula`. */}
              <CurrencyInput
                value={values.grossTotal}
                onChange={(value) => {
                  update("grossTotal", value);
                  if (form.hasGrid) form.refreshSplit(value, values.finalTotal);
                }}
                className="h-10 bg-background"
                readOnly={readOnly || values.costSplitManual}
                allowFormula
              />
              <p className="text-xs text-muted-foreground">
                {values.costSplitManual ? (
                  "Soma das variações."
                ) : (
                  <>
                    Aceita conta: <span className="font-mono">=17,99*2</span>
                  </>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Total final {costRequired && <span className="text-red-500">*</span>}
              </label>
              <CurrencyInput
                value={values.finalTotal}
                onChange={(value) => {
                  update("finalTotal", value);
                  if (form.hasGrid) form.refreshSplit(values.grossTotal, value);
                }}
                className="h-10 bg-background"
                readOnly={readOnly || values.costSplitManual}
                allowFormula
              />
              <p className="text-xs text-muted-foreground">
                {values.costSplitManual ? "Soma das variações." : "Já com desconto ou acréscimo (frete)."}
                {costRequired && " Obrigatório fora de Pendente."}
              </p>
            </div>
          </div>

          <PurchaseDerivedTotals derived={derived} />

          {/* O preço de venda decidido na hora de COMPRAR: é aqui que se olha para
              o custo, e é aqui que a conta de margem ainda pode mudar a decisão de
              comprar. No recebimento ele já vem preenchido e passa a valer no
              cadastro do produto.

              O campo NASCE com o preço do cálculo de margem (40% sobre o custo
              unitário) assim que o custo existe, e segue editável: na maioria das
              compras a sugestão é o que se pratica, e digitá-la de novo seria
              repetir uma conta que a tela já fez. Ver `usePurchaseForm`. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Preço sugerido de venda
              </label>
              <CurrencyInput
                value={values.suggestedPrice}
                onChange={(value) => update("suggestedPrice", value)}
                className="h-10 bg-background"
                readOnly={readOnly}
                allowFormula
              />
              {/* O preço que a loja cobra HOJE, ao lado do que vai passar a valer:
                  é a comparação que decide se a compra muda a etiqueta. Em produto
                  novo não existe preço atual, e a linha simplesmente não aparece. */}
              {values.productPrice !== null && (
                <p className="text-xs text-muted-foreground">
                  Preço atual do produto:{" "}
                  <span className="font-medium text-foreground">{formatCurrency(values.productPrice)}</span>
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <PricingPreview
                unitCost={derived.unitFinal}
                price={values.suggestedPrice}
                onApplySuggested={(price) => update("suggestedPrice", price)}
                readOnly={readOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Detalhes</label>
              <Textarea
                value={values.details}
                onChange={(event) => update("details", event.target.value)}
                placeholder="Cor, tamanho, referência do fornecedor..."
                className="min-h-16"
                readOnly={readOnly}
              />
            </div>
            <PurchaseLinkField
              value={values.purchaseLink}
              onChange={(value) => update("purchaseLink", value)}
              required={linkRequired}
              supplierName={form.supplier?.name}
              readOnly={readOnly}
            />
          </div>

          <PurchaseImagesField
            images={values.images}
            readOnly={readOnly}
            uploading={form.uploading}
            loading={form.loadingGroup}
            isProductGallery={temProduto}
            productName={values.productName}
            onFileSelection={form.handleFileSelection}
            onAddUrl={form.addImageFromUrl}
            onRemove={form.removeImage}
            onSearchWeb={() => form.setImageSearchOpen(true)}
          />

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={form.requestClose}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
                // `loadingGroup`: salvar antes de a galeria do produto chegar
                // gravaria a compra sem fotos — e, numa edição, esvaziaria a
                // galeria do próprio produto.
                disabled={form.isSaving || form.uploading || form.loadingGroup}
              >
                {form.isSaving ? "Salvando..." : form.editingId ? "Salvar alterações" : "Registrar compra"}
              </Button>
            )}
          </div>
        </form>

        {/* Escolher um produto já cadastrado por cima de nome digitado ou foto
            anexada pergunta antes de substituir. Ver `PurchaseProductLinkDialog`. */}
        <PurchaseProductLinkDialog
          product={form.pendingProduct}
          purchaseName={values.productName}
          imageCount={values.images.length}
          onUseProductGallery={form.confirmProductWithGallery}
          onKeepPurchaseImages={form.confirmProductKeepingImages}
          onCancel={form.cancelProductSelection}
        />

        <ConfirmDialog
          open={form.discardOpen}
          onOpenChange={(aberto) => !aberto && form.cancelDiscard()}
          title="Descartar alterações?"
          description="Há alterações não salvas nesta compra. Sair agora descarta tudo o que foi preenchido — inclusive as fotos adicionadas."
          confirmLabel="Descartar e sair"
          cancelLabel="Continuar editando"
          destructive
          onConfirm={form.confirmDiscard}
        />
      </DialogContent>
    </Dialog>
  );
}

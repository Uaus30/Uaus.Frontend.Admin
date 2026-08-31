import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@workspace/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui";
import { useToast } from "@workspace/ui";
import type { useProductEditor } from "../../hooks/useProductEditor";
import type { ProductGrade, VariationDraft } from "../../types";
import { buildDisplayBarcode, isFactoryEan, printBarcodeLabel } from "../../lib/barcode";
import { nomeExibidoDaVariacao } from "../../lib/variationMatrix";
import { collectPastedImageFiles, optimizePastedImages } from "../../lib/pasteProductImages";
import { validateProductForm } from "../../lib/validateProductForm";
import { ProductOptionalFields } from "../editor/ProductOptionalFields";
import { ProductEditorDialogs } from "./ProductEditorDialogs";
import { VariationGradesModal } from "./VariationGradesModal";
import { ProductGeneralTab } from "./ProductGeneralTab";
import { ProductStockTab } from "./ProductStockTab";
import { ProductWebImageSearch } from "./ProductWebImageSearch";

type ProductDetailScreenProps = {
  editor: ReturnType<typeof useProductEditor>;
  /** Pediu para sair (voltar, cancelar) — a página decide se confirma antes. */
  onRequestClose: () => void;
};

/**
 * Tela de detalhe do produto, em três abas.
 *
 * Substituiu a modal de edição em 30/08/2026. A modal empilhava tudo numa
 * rolagem só e escondia cinco campos atrás de um botão de olho que nada na tela
 * anunciava; e o estoque do produto ficava a uma navegação de distância, em
 * `/estoque/entradas?productId=`, que tirava a pessoa do cadastro.
 *
 * As abas separam por FREQUÊNCIA de uso, não por assunto:
 *
 * - **Dados** — o que o cadastro do dia a dia preenche e sem o que não salva.
 * - **Estoque** — o histórico de entradas do produto e o lançamento rápido.
 * - **Opcionais** — o que era o olho fechado.
 *
 * O `<form>` envolve as três: o salvar do cabeçalho vale de qualquer aba, e
 * quem troca de aba com alterações pendentes não as perde. As modais são
 * portais do Radix, então ficam FORA do form — o formulário simplificado de
 * entrada tem `<form>` próprio e aninhar os dois seria HTML inválido.
 */
export function ProductDetailScreen({ editor, onRequestClose }: ProductDetailScreenProps) {
  const { toast } = useToast();
  const {
    isDirty,
    form,
    productEditor,
    variationDrafts,
    activeVariation,
    editingGroupId,
    setImages,
    saving,
    handleSubmit,
    handleDeleteVariation,
    selectedGrades,
    generateVariationsMatrix,
  } = editor;

  const [activeTab, setActiveTab] = useState("dados");
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [gradesModalOpen, setGradesModalOpen] = useState(false);
  const [variationToDelete, setVariationToDelete] = useState<VariationDraft | null>(null);
  // Código cuja piscada já terminou. É ESTE o estado, e não um `flashSuccess`
  // booleano: com o booleano, desligar a piscada exigia um `setState` síncrono
  // dentro do efeito — cascata de render que o lint recusa. Guardando o código,
  // a piscada é derivada, e o único `setState` acontece no fim do temporizador.
  const [flashedBarcode, setFlashedBarcode] = useState<string | null>(null);
  const [pickedStockProductId, setPickedStockProductId] = useState<number | null>(null);

  const currentBarcode = productEditor.barcode || "";
  const displayBarcode = buildDisplayBarcode(currentBarcode, productEditor.id);

  /** Variações JÁ GRAVADAS: só elas têm id, e só id tem entrada de estoque. */
  const variationOptions = useMemo(
    () =>
      variationDrafts
        .filter((draft): draft is VariationDraft & { id: number } => draft.id != null && draft.id > 0)
        // Nome COMPOSTO: o seletor precisa distinguir as variações, e `name` é
        // o do grupo em todas elas.
        .map((draft) => ({ id: draft.id, name: nomeExibidoDaVariacao(form.productGroupName, draft.values) })),
    [variationDrafts, form.productGroupName],
  );

  const defaultStockProductId = form.hasVariations
    ? (activeVariation?.id ?? variationOptions[0]?.id ?? null)
    : (productEditor.id ?? null);

  // A escolha do operador só vale enquanto a variação existir: apagar a variação
  // aberta deixaria a aba consultando um produto que não está mais na lista.
  const stockProductId =
    pickedStockProductId !== null && variationOptions.some((o) => o.id === pickedStockProductId)
      ? pickedStockProductId
      : defaultStockProductId;

  const stockVariation = variationDrafts.find((draft) => draft.id === stockProductId);
  // Nome COMPOSTO: o `name` da variação é o do grupo, igual em todas. Sem o
  // colchete, a modal de entrada não diria QUAL variação está recebendo.
  const stockProductName = stockVariation
    ? nomeExibidoDaVariacao(form.productGroupName, stockVariation.values)
    : productEditor.name || form.productGroupName;
  const stockProductBarcode = (stockVariation?.barcode ?? productEditor.barcode) || null;

  /** Pisca a borda do campo enquanto o código bipado for EAN de fábrica. */
  const flashSuccess = isFactoryEan(currentBarcode) && flashedBarcode !== currentBarcode;

  useEffect(() => {
    if (!flashSuccess) return;

    const timer = setTimeout(() => setFlashedBarcode(currentBarcode), 800);
    return () => clearTimeout(timer);
  }, [flashSuccess, currentBarcode]);

  // Recarregar ou fechar a aba com alterações pendentes ganha o aviso nativo do
  // navegador — a confirmação bonita fica para os caminhos que a tela controla.
  useEffect(() => {
    if (!isDirty) return;

    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [isDirty]);

  function fecharTela() {
    onRequestClose();
  }

  /** Gera a matriz e leva o operador até a tabela recém-criada. */
  function aplicarGrades(grades: ProductGrade[]) {
    generateVariationsMatrix(grades);
    setGradesModalOpen(false);
    setActiveTab("dados");

    setTimeout(() => {
      document.getElementById("variations-table-container")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
  }

  async function handleLocalSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Só o submit DESTE formulário grava o produto.
    //
    // A aba Estoque abre uma modal com `<form>` próprio. Ela vai para um portal
    // do Radix, então no DOM está fora daqui — mas o React propaga eventos pela
    // ÁRVORE DE COMPONENTES, não pelo DOM, e o submit da modal chegava aqui
    // também. O efeito era mudo e caro: salvar a entrada de estoque gravava o
    // produto junto (PUT em ProductGroups e Products, com linha no histórico) e
    // fechava a tela por cima do lançamento. `e.preventDefault()` da modal não
    // ajuda — ele impede a navegação, não a propagação.
    if (e.target !== e.currentTarget) return;

    e.preventDefault();

    const { errors, firstErrorElementId } = validateProductForm({ form, productEditor, variationDrafts });
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Todo campo obrigatório mora na aba Dados. Focar um elemento de aba
      // fechada não faz nada, e o salvar pareceria simplesmente não responder.
      setActiveTab("dados");
      if (firstErrorElementId) {
        setTimeout(() => document.getElementById(firstErrorElementId)?.focus(), 50);
      }
      return;
    }

    setValidationErrors({});
    await handleSubmit(e);
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLFormElement>) {
    const files = collectPastedImageFiles(event.clipboardData?.items);
    if (files.length === 0) return;

    event.preventDefault();
    const result = await optimizePastedImages(files);

    if (result.optimized) {
      toast({
        title: "Imagens coladas otimizadas",
        description: `${(result.originalSize / 1024 / 1024).toFixed(2)}MB reduzido para ${(result.optimizedSize / 1024).toFixed(0)}KB (economizou ${Math.round((1 - result.optimizedSize / result.originalSize) * 100)}%)`,
      });
    }

    setImages((current) => [...current, ...result.images]);
  }

  return (
    <>
      <form onSubmit={handleLocalSubmit} onPaste={handlePaste} className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hover-elevate shrink-0 border border-border bg-card"
              onClick={fecharTela}
              aria-label="Voltar para a lista de produtos"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-3xl font-bold text-foreground">
                {form.productGroupName || "Novo Produto"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {editingGroupId ? `ID #${editingGroupId}` : "Cadastro novo"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={fecharTela}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground hover-elevate"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="estoque">Estoque</TabsTrigger>
            <TabsTrigger value="opcionais">Opcionais</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4">
            <ProductGeneralTab
              editor={editor}
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
              displayBarcode={displayBarcode}
              currentBarcode={currentBarcode}
              flashSuccess={flashSuccess}
              onPrintBarcode={() =>
                printBarcodeLabel({
                  barcode: displayBarcode,
                  name: form.productGroupName,
                  price: productEditor.price,
                })
              }
              onPrintVariationBarcode={(barcode, name, price) => printBarcodeLabel({ barcode, name, price })}
              setSearchModalOpen={setSearchModalOpen}
              setVariationToDelete={setVariationToDelete}
              onOpenGradePicker={() => setGradesModalOpen(true)}
            />
          </TabsContent>

          <TabsContent value="estoque" className="mt-4">
            <ProductStockTab
              productId={stockProductId}
              productName={stockProductName}
              barcode={stockProductBarcode}
              variationOptions={variationOptions}
              onSelectProduct={setPickedStockProductId}
            />
          </TabsContent>

          <TabsContent value="opcionais" className="mt-4">
            <ProductOptionalFields editor={editor} />
          </TabsContent>
        </Tabs>
      </form>

      <ProductEditorDialogs
        variationToDelete={variationToDelete}
        setVariationToDelete={setVariationToDelete}
        onConfirmDeleteVariation={handleDeleteVariation}
      />

      <VariationGradesModal
        open={gradesModalOpen}
        onOpenChange={setGradesModalOpen}
        selectedGrades={selectedGrades}
        variationCount={variationDrafts.length}
        onConfirm={aplicarGrades}
      />

      <ProductWebImageSearch editor={editor} open={searchModalOpen} onOpenChange={setSearchModalOpen} />
    </>
  );
}

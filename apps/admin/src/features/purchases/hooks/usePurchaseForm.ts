import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { describeApiError, resolveBarcodeInput, suggestedPrice, toDateKey } from "@workspace/core";
import {
  PURCHASE_STATUS,
  buildPublicImageUrl,
  createPurchase,
  enumCode,
  updatePurchase,
  type CategoryDto,
  type PurchaseDto,
  type SavePurchasePayload,
  type SupplierDto,
} from "@workspace/api-client-react";
import { getProductGroupById, getProductGroupImages } from "@/services/products.service";
import type { ProductSearchOption } from "@/components/product-search-picker";
import { useSessao } from "@/hooks/use-sessao";
import { syncPurchaseDetailParam } from "../purchases-route";
import { derivePurchaseTotals } from "../lib/purchase-totals";
import {
  applyPurchaseDefaults,
  purchaseDefaultsFromPayload,
  readPurchaseDefaults,
  rememberPurchaseDefaults,
} from "../lib/purchase-memory";
import type { PurchaseForm, PurchaseFormItem } from "../types";
import { usePurchaseBarcodeLookup } from "./usePurchaseBarcodeLookup";
import { usePurchaseImages } from "./usePurchaseImages";
import { usePurchaseVariations } from "./usePurchaseVariations";

/** Hoje, em `yyyy-MM-dd` — componentes LOCAIS, nunca `toISOString()`. */
export function todayDateKey(): string {
  return toDateKey(new Date());
}

/** O dia de uma data do backend (`2026-09-06T00:00:00`), para o campo de data. */
function dateKeyFromApi(value: string | undefined | null): string {
  return value ? value.slice(0, 10) : todayDateKey();
}

export function emptyPurchaseForm(): PurchaseForm {
  return {
    supplierId: "",
    productId: null,
    productGroupId: null,
    productPrice: null,
    categoryId: "",
    departmentId: "",
    items: [],
    costSplitManual: false,
    productName: "",
    productBarcode: null,
    invoiceNumber: "",
    details: "",
    purchaseLink: "",
    purchaseDate: todayDateKey(),
    quantity: 1,
    grossTotal: 0,
    finalTotal: 0,
    suggestedPrice: 0,
    status: String(PURCHASE_STATUS.Pending),
    images: [],
  };
}

/**
 * O departamento de uma categoria, como string do `<Select>`.
 *
 * O departamento não é gravado em lugar nenhum — nem na compra, nem no grupo de
 * produto. Ele sai da categoria, e serve só para filtrar a lista de categorias
 * na tela, como no editor de produto.
 */
export function departmentOfCategory(
  categoryId: number | null | undefined,
  categories: CategoryDto[],
): string {
  if (categoryId == null) return "";
  const category = categories.find((item) => item.id === categoryId);
  return category ? String(category.departmentId) : "";
}

/**
 * Carrega uma compra gravada no formulário.
 *
 * As `categories` entram só para resolver o DEPARTAMENTO da categoria gravada —
 * ele não viaja na compra. Sem elas (catálogo ainda carregando) o select de
 * departamento nasce vazio e se preenche no render seguinte.
 */
export function purchaseToForm(purchase: PurchaseDto, categories: CategoryDto[] = []): PurchaseForm {
  const status = enumCode(purchase.status, PURCHASE_STATUS);
  return {
    supplierId: String(purchase.supplierId),
    // `?? null`: o backend omite campos nulos e o formulário compara com `=== null`.
    productId: purchase.productId ?? null,
    productGroupId: purchase.productGroupId ?? null,
    productPrice: purchase.productPrice ?? null,
    // Com produto vinculado o backend já devolve a categoria do GRUPO aqui.
    categoryId: purchase.categoryId == null ? "" : String(purchase.categoryId),
    departmentId: departmentOfCategory(purchase.categoryId, categories),
    // A grade gravada — só quando ela EXISTE, ou seja, com mais de uma variação.
    //
    // Compra de um produto só tem UM item no banco, espelho do cabeçalho, e
    // nenhuma grade na tela para editá-lo. Carregá-lo aqui fazia o campo de
    // quantidade mentir: ele edita o cabeçalho, o item ficava com o valor antigo,
    // e no salvar o backend deriva a quantidade dos ITENS quando eles vêm — então
    // o valor digitado era descartado em silêncio, com toast de sucesso
    // (produção, compra #31: editada de 1 para outro número e gravada como 1).
    //
    // Com a lista vazia, o corpo vai sem `items` e o backend usa o cabeçalho, que
    // é o caminho de compatibilidade de sempre. É também o que torna a regra à
    // prova da corrida: a grade só aparece depois que a lista de variações do
    // grupo chega, e até lá o cabeçalho manda.
    items:
      (purchase.items ?? []).length > 1
        ? (purchase.items ?? []).flatMap<PurchaseFormItem>((item) =>
            item.productId == null
              ? []
              : [
                  {
                    productId: item.productId,
                    name: item.productName,
                    barcode: item.barcode ?? null,
                    stock: item.stock,
                    quantity: item.quantity,
                    grossTotal: item.grossTotal,
                    finalTotal: item.finalTotal,
                  },
                ],
          )
        : [],
    costSplitManual: purchase.costSplitManual ?? false,
    productName: purchase.productName,
    productBarcode: purchase.productBarcode ?? null,
    invoiceNumber: purchase.invoiceNumber ?? "",
    details: purchase.details ?? "",
    purchaseLink: purchase.purchaseLink ?? "",
    purchaseDate: dateKeyFromApi(purchase.purchaseDate),
    quantity: purchase.quantity,
    grossTotal: purchase.grossTotal,
    finalTotal: purchase.finalTotal,
    // Zero é "não informado": o campo de moeda não distingue vazio de zero, e o
    // backend recebe nulo nesse caso.
    suggestedPrice: purchase.suggestedPrice ?? 0,
    status: String(status === PURCHASE_STATUS.None ? PURCHASE_STATUS.Pending : status),
    images: purchase.images.map((image) => ({
      imageId: image.imageId,
      url: buildPublicImageUrl(image.url),
      name: purchase.productName,
    })),
  };
}

/**
 * A compra já aponta para um produto CADASTRADO?
 *
 * **Não basta olhar o `productId`.** Ele só é preenchido quando a compra é de
 * UMA variação; com a grade preenchida o cabeçalho fica sem produto — quem
 * responde o que foi comprado são os itens — e o que sempre está lá é o GRUPO.
 *
 * Errar isso não gera erro: a compra com variações passava por "produto novo" e
 * o "Lançar recebimento" abria o CADASTRO em branco, criando um produto novo,
 * sem variações, ao lado do que já existia. O mesmo critério decide se o
 * formulário mostra a busca de produto ou o produto vinculado.
 */
export function purchaseHasProduct(dados: {
  productId?: number | null;
  productGroupId?: number | null;
}): boolean {
  // `!= null` de propósito: o backend omite campos nulos e eles chegam AUSENTES.
  return dados.productId != null || dados.productGroupId != null;
}

/**
 * O link é exigido nesta compra?
 *
 * Em marketplace, sair de "Pendente" sem o link deixa a loja com uma compra que
 * ninguém consegue rastrear: a plataforma tem vários vendedores, e não há
 * representante, catálogo nem número de pedido para consultar depois. Pendente
 * fica livre de propósito — é onde se anota a intenção de comprar, antes mesmo
 * de escolher o anúncio.
 *
 * A mesma regra existe no backend (`PurchaseService.EnsurePurchaseLinkAsync`).
 * Aqui ela é conveniência: avisa antes do envio, em vez de deixar o operador
 * preencher tudo para receber um 400.
 */
export function purchaseLinkIsRequired(form: PurchaseForm, supplier: SupplierDto | undefined): boolean {
  return Boolean(supplier?.isMarketplace) && Number(form.status) !== PURCHASE_STATUS.Pending;
}

/**
 * Os totais (bruto e final) são exigidos nesta compra?
 *
 * Pendente é a anotação de "preciso comprar isto" — nasce do relatório de
 * estoque baixo ou de uma ideia no balcão, antes de escolher o anúncio, negociar
 * o preço ou saber o frete. Exigir o custo ali obrigaria a inventar um número, e
 * número inventado vira custo de lote no recebimento. A partir de "A caminho" a
 * compra já foi feita e o valor pago existe: é dele que sai o custo unitário da
 * entrada.
 *
 * **O bruto também, desde 24/09/2026.** Ele passou a ser o número que se digita
 * primeiro — o final nasce igual a ele e só muda quando há desconto ou frete —,
 * e sem ele a compra não registra o desconto negociado. Até ali o bruto era
 * opcional em qualquer situação.
 *
 * A mesma regra existe no backend (`PurchaseRules.EnsureTotalsInformed`), também
 * para o menu "Marcar como a caminho". O recebimento continua exigindo só o final:
 * compra "A caminho" de antes desta data pode estar sem bruto, e a entrada grava o
 * bruto igual ao custo nesse caso. Aqui é conveniência: avisa antes do envio.
 */
export function purchaseCostIsRequired(form: PurchaseForm): boolean {
  return Number(form.status) !== PURCHASE_STATUS.Pending;
}

/**
 * Departamento e categoria são do PRODUTO, e por isso ficam travados quando a
 * compra aponta para um cadastro.
 *
 * Eles aparecem preenchidos porque respondem "o que é isto que estou
 * comprando?" sem obrigar a abrir outra tela. Mas quem edita a categoria de um
 * produto é a tela de Produtos: deixá-la editável aqui daria duas respostas
 * para a mesma pergunta — e mudar a do produto por efeito colateral de salvar
 * uma compra é o tipo de coisa que ninguém procura quando o item some do filtro
 * da vitrine.
 *
 * Sem produto vinculado é o contrário: a categoria é obrigatória, porque é ela
 * que o cadastro gerado no recebimento recebe pronto.
 */
export function purchaseCategoryIsLocked(form: PurchaseForm): boolean {
  return purchaseHasProduct(form);
}

/**
 * Vincular este produto descarta algo que o operador escreveu nesta compra?
 *
 * Duas coisas são substituídas ao escolher um produto já cadastrado, e as duas
 * podem ter sido preenchidas à mão numa compra de produto novo:
 *
 * - **o nome**, que passa a ser o do catálogo (o backend regrava
 *   `purchases.product_name` a partir do produto, em toda compra vinculada);
 * - **as fotos**, porque a galeria da compra e a do grupo são a mesma lista
 *   desde 13/09/2026.
 *
 * Compara o nome em caixa alta porque é assim que ele é gravado
 * (`ProductDisplayName.Normalize`) e é assim que o campo da modal digita: sem
 * isso, escolher o produto certo depois de digitar o nome dele perguntaria à
 * toa, e pergunta que aparece à toa é a que ninguém lê.
 */
export function purchaseDataWouldBeReplaced(form: PurchaseForm, productName: string): boolean {
  if (form.images.length > 0) return true;
  const digitado = form.productName.trim().toUpperCase();
  return digitado.length > 0 && digitado !== productName.trim().toUpperCase();
}

/** O que falta no formulário para gravar, ou `null` quando está pronto. */
export function validatePurchaseForm(form: PurchaseForm, supplier?: SupplierDto): string | null {
  if (!form.supplierId) return "Selecione o fornecedor.";
  if (!purchaseHasProduct(form) && !form.productName.trim()) return "Informe o produto ou o nome do produto.";
  // Só onde ela tem dono: com produto vinculado a categoria é a do grupo, e vem
  // preenchida e travada. Sem cadastro, é ela que o recebimento vai usar.
  if (!purchaseCategoryIsLocked(form) && !form.categoryId)
    return "Selecione o departamento e a categoria: é com eles que o produto vai ser cadastrado no recebimento.";
  if (!form.purchaseDate) return "Informe a data da compra.";
  if (form.purchaseDate > todayDateKey()) return "A data da compra não pode estar no futuro.";
  if (form.items.length > 0 && form.items.every((item) => item.quantity <= 0))
    return "Informe a quantidade de ao menos uma variação.";
  if (form.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 0))
    return "A quantidade de cada variação deve ser um inteiro maior ou igual a zero.";
  if (!Number.isInteger(form.quantity) || form.quantity <= 0)
    return "A quantidade deve ser um inteiro maior que zero.";
  if (form.grossTotal < 0 || form.finalTotal < 0) return "Os valores não podem ser negativos.";
  if (form.suggestedPrice < 0) return "O preço sugerido de venda não pode ser negativo.";
  // O bruto primeiro: o final nasce igual a ele, e digitá-lo resolve os dois.
  if (purchaseCostIsRequired(form) && form.grossTotal <= 0)
    return "Informe o total bruto da compra: só compra pendente pode ficar sem ele.";
  if (purchaseCostIsRequired(form) && form.finalTotal <= 0)
    return "Informe o total final da compra (o custo): só compra pendente pode ficar sem ele.";
  // O código só é da compra sem produto vinculado; com produto, é o do cadastro.
  // A regra é a do cadastro de produto, e a mensagem também — é lá que ele vai
  // parar no recebimento.
  if (!purchaseHasProduct(form) && form.productBarcode) {
    const codigo = resolveBarcodeInput(form.productBarcode);
    if (codigo.kind === "invalid") return codigo.error;
  }
  if (purchaseLinkIsRequired(form, supplier) && !form.purchaseLink.trim())
    return `Informe o link da compra: ${supplier?.name ?? "este fornecedor"} é um marketplace, e sem o link não há como reencontrar o anúncio depois.`;
  return null;
}

type UsePurchaseFormParams = {
  /** Depois de gravar: quem chama invalida a listagem. */
  onSaved: () => Promise<unknown>;
  /**
   * Catálogo de fornecedores da tela. O formulário precisa dele para saber se o
   * escolhido é marketplace — a regra do link depende do cadastro, não do que
   * foi digitado.
   */
  suppliers: SupplierDto[];
  /**
   * Catálogo de categorias. Serve para resolver o DEPARTAMENTO da categoria — a
   * relação mora em `categories.departmentId`, e nem a compra nem o grupo de
   * produto guardam o departamento.
   */
  categories: CategoryDto[];
};

/**
 * Formulário da compra: estado, produto vinculado, fotos e a gravação.
 *
 * As fotos vivem no `usePurchaseImages`, que este hook reexporta inteiro — são
 * quatro caminhos de entrada (arquivo, Ctrl+V, URL e busca na web) com
 * compressão e upload imediatos, e o corpo da compra leva só os ids.
 *
 * Dois campos merecem nota por não serem óbvios no payload:
 *
 * - **A data da compra** viaja como instante local (`T00:00:00`), não como
 *   `toISOString()`: a coluna é `timestamp without time zone` e o UTC jogaria o
 *   dia para trás no Brasil.
 * - **O preço sugerido zero vira nulo.** O `CurrencyInput` não distingue vazio
 *   de zero, e um zero gravado faria o recebimento tentar aplicar preço zero ao
 *   produto — nulo é o que mantém o preço atual do cadastro.
 */
export function usePurchaseForm({ onSaved, suppliers, categories }: UsePurchaseFormParams) {
  const { toast } = useToast();
  // A memória da última compra é por usuário. Sem custo de rede: o `useGetMe`
  // lê a sessão guardada no navegador.
  const { data: usuario } = useSessao();
  const userId = usuario?.id ?? null;

  const [open, setOpenState] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  /**
   * A galeria e a categoria do produto escolhido estão sendo buscadas.
   *
   * Trava o salvar enquanto isso. Sem a trava, quem escolhesse o produto e
   * clicasse em "Registrar compra" no mesmo segundo gravaria a compra com a
   * lista de fotos vazia — e, numa EDIÇÃO, isso esvaziaria a galeria do produto.
   */
  const [loadingGroup, setLoadingGroup] = useState(false);
  /**
   * O operador já mexeu no preço sugerido nesta compra?
   *
   * Enquanto não mexeu, o campo acompanha o cálculo de margem sobre o custo
   * unitário: digitar o total final preenche o preço sozinho. Depois de mexer,
   * o número é dele — recalcular jogaria fora a decisão que a tela acabou de
   * pedir. Compra aberta com preço já gravado nasce "mexida" pelo mesmo motivo.
   */
  const [precoTocado, setPrecoTocado] = useState(false);
  /**
   * O operador já mexeu no total final nesta compra?
   *
   * Enquanto não mexeu, o final ACOMPANHA o bruto (24/09/2026): digitar o bruto
   * preenche o final com o mesmo valor, que é o caso de toda compra sem desconto
   * nem frete. Mexeu, o número é dele — o desconto negociado não pode sumir porque
   * alguém corrigiu o bruto depois. Compra aberta com final diferente do bruto
   * nasce "mexida" pelo mesmo motivo.
   *
   * Ref, e não estado: nada na tela depende dele para desenhar, e o `update` o lê
   * dentro do `setForm` — com estado, dois campos mexidos no mesmo evento leriam
   * o valor do render anterior.
   */
  const finalTocadoRef = useRef(false);
  /**
   * A data que veio da memória da última compra, quando ela NÃO é hoje.
   *
   * A memória atravessa dias de propósito — é o que o dono pediu —, e por isso
   * pode trazer a data de uma compra de ontem para a de hoje. Enquanto o campo
   * estiver com ela, a tela avisa para conferir.
   */
  const [dataLembrada, setDataLembrada] = useState<string | null>(null);

  /**
   * Fechar a modal tira a compra da URL. O link só vale enquanto ela está
   * aberta — deixá-lo lá faria um F5 reabrir a compra que a pessoa acabou de
   * fechar. Todo caminho de fechar (Cancelar, clique fora, gravar) passa aqui.
   */
  function setOpen(value: boolean) {
    setOpenState(value);
    if (!value) {
      syncPurchaseDetailParam(null);
      setDirty(false);
      setDiscardOpen(false);
      setPendingProduct(null);
      setPendingBarcode(null);
    }
  }
  const [form, setForm] = useState<PurchaseForm>(emptyPurchaseForm);

  /**
   * O operador mexeu em alguma coisa desde que a modal abriu?
   *
   * É o que decide se fechar pergunta antes de descartar. Sujam o formulário só
   * os GESTOS dele; o preenchimento automático — a grade das variações, a
   * categoria e as fotos do grupo escolhido, o departamento vindo da categoria e
   * o preço pela margem — usa o `setForm` cru e não conta. Sem essa separação,
   * abrir uma compra e fechá-la sem digitar nada já perguntaria se quer
   * descartar, e a pergunta que aparece à toa é a que ninguém lê.
   */
  const [dirty, setDirty] = useState(false);
  /** A confirmação de descartar está aberta, esperando a resposta. */
  const [discardOpen, setDiscardOpen] = useState(false);
  /**
   * O produto escolhido no seletor, esperando a resposta sobre nome e fotos.
   *
   * Existe só quando o vínculo vai substituir alguma coisa — ver
   * `purchaseDataWouldBeReplaced`. Nos outros casos o produto é aplicado direto,
   * porque não há duas respostas possíveis e a pergunta seria ruído.
   */
  const [pendingProduct, setPendingProduct] = useState<ProductSearchOption | null>(null);
  /**
   * O código que ACHOU o `pendingProduct`, quando a pergunta nasceu do campo de
   * código e não da busca. "Não vincular" apaga esse código: ele já é do produto,
   * e deixá-lo ali só adiaria a recusa para o salvar — além de o leitor ACRESCENTAR
   * ao que está no campo, e o bipe seguinte virar dois códigos emendados.
   */
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

  function markDirty() {
    setDirty(true);
  }

  /** O `setForm` dos gestos do operador — o que os sub-hooks recebem. */
  const setFormTouched: React.Dispatch<React.SetStateAction<PurchaseForm>> = (value) => {
    markDirty();
    setForm(value);
  };

  const images = usePurchaseImages({ productName: form.productName, setForm: setFormTouched });
  const variations = usePurchaseVariations({ form, setForm, onEdit: markDirty });
  /**
   * Compra lançada abre em leitura, e não deixa de abrir.
   *
   * O backend recusa editar uma compra já lançada — a entrada de estoque existe,
   * e mudar quantidade ou custo aqui deixaria os dois documentos discordando.
   * Mas continuar podendo ABRIR é o que faz a linha inteira ser clicável sem
   * exceção: quem clica quer ver o que comprou, não necessariamente mudar.
   */
  const [readOnly, setReadOnly] = useState(false);

  const supplier = suppliers.find((item) => String(item.id) === form.supplierId);

  // O campo de código só existe na compra de produto novo, e é só ali que um
  // código já cadastrado tem o que vincular.
  const barcodeLookup = usePurchaseBarcodeLookup({
    enabled: open && !readOnly && !purchaseHasProduct(form),
    onFound: selectProductByBarcode,
  });

  /**
   * Traz do servidor a categoria e a GALERIA do grupo escolhido.
   *
   * É o que faz a modal exibir as fotos do produto ao escolhê-lo: a galeria da
   * compra e a do grupo são a mesma lista desde 13/09/2026, e salvar replica o
   * que estiver aqui de volta no produto.
   *
   * Busca direta, e não `useQuery`: acontece UMA vez, no gesto de escolher o
   * produto, e o que interessa é o estado do servidor naquele instante — cache
   * aqui só serviria para devolver uma galeria que a tela de Produtos já mudou.
   *
   * A gravação só é liberada depois (`loadingGroup`), e o resultado é
   * descartado se o operador trocar de produto no meio do caminho.
   *
   * Com `manterFotos`, a galeria do grupo nem é buscada: o operador respondeu
   * que as fotos desta compra é que valem, e é a lista do formulário que vai
   * substituir a do produto no salvar. A categoria continua vindo, porque ela
   * não é escolha — com produto vinculado, é sempre a do cadastro.
   */
  async function loadProductGroup(productGroupId: number, manterFotos = false) {
    setLoadingGroup(true);
    try {
      const [grupo, galeria] = await Promise.all([
        getProductGroupById(productGroupId),
        manterFotos ? Promise.resolve(null) : getProductGroupImages(productGroupId),
      ]);

      setForm((current) => {
        if (current.productGroupId !== productGroupId) return current;
        return {
          ...current,
          categoryId: String(grupo.categoryId),
          departmentId: departmentOfCategory(grupo.categoryId, categories),
          images:
            galeria === null
              ? current.images
              : galeria.map((image) => ({
                  imageId: image.imageId,
                  url: buildPublicImageUrl(image.url),
                  name: image.name,
                })),
        };
      });
    } catch (error) {
      toast({
        title: "Não foi possível carregar as fotos do produto",
        description: describeApiError(error, "Reabra a compra antes de salvar, para não gravar sem elas."),
        error,
        variant: "destructive",
      });
    } finally {
      setLoadingGroup(false);
    }
  }

  /**
   * Compra nova: nasce com fornecedor, data, nº da nota e situação da última
   * compra registrada por este usuário neste navegador (24/09/2026). Sem memória
   * — primeiro uso, ou dados do navegador apagados —, nasce com o padrão.
   */
  function openNew() {
    setDirty(false);
    setEditingId(null);
    const vazio = emptyPurchaseForm();
    const lembrado = readPurchaseDefaults(userId);
    setForm(lembrado ? applyPurchaseDefaults(vazio, lembrado, suppliers) : vazio);
    setDataLembrada(lembrado && lembrado.purchaseDate !== vazio.purchaseDate ? lembrado.purchaseDate : null);
    setReadOnly(false);
    setPrecoTocado(false);
    finalTocadoRef.current = false;
    setOpen(true);
  }

  function openEdit(purchase: PurchaseDto) {
    setDirty(false);
    setEditingId(purchase.id);
    setForm(purchaseToForm(purchase, categories));
    setReadOnly(enumCode(purchase.status, PURCHASE_STATUS) === PURCHASE_STATUS.Received);
    // Preço já decidido é decisão tomada: o cálculo de margem não a substitui.
    setPrecoTocado((purchase.suggestedPrice ?? 0) > 0);
    // Final diferente do bruto é desconto ou frete já registrado: corrigir o
    // bruto não pode apagá-lo.
    finalTocadoRef.current = purchase.finalTotal > 0 && purchase.finalTotal !== purchase.grossTotal;
    setDataLembrada(null);
    setOpen(true);
    // A URL passa a dizer qual compra está aberta (`/estoque/compras?compra=12`):
    // é o link que se copia para mandar a compra a alguém, e `usePurchaseFromUrl`
    // o traz de volta a esta mesma modal.
    syncPurchaseDetailParam(purchase.id);
  }

  /**
   * Abre uma compra NOVA de reposição, já com produto, fornecedor e quantidade.
   *
   * É o destino do "Resolver" do relatório de estoque baixo: lá, resolver o
   * alerta é registrar o pedido. A situação nasce Pendente e tudo continua
   * editável — o formulário é o mesmo de sempre.
   */
  function openForRestock(dados: {
    productId: number;
    productGroupId: number;
    productName: string;
    productBarcode: string | null;
    productPrice: number | null;
    supplierId: number | null;
    quantity: number;
  }) {
    setDirty(false);
    setEditingId(null);
    setReadOnly(false);
    setPrecoTocado(false);
    finalTocadoRef.current = false;
    setDataLembrada(null);
    setForm({
      ...emptyPurchaseForm(),
      productId: dados.productId,
      productGroupId: dados.productGroupId,
      productName: dados.productName,
      productBarcode: dados.productBarcode,
      productPrice: dados.productPrice,
      supplierId: dados.supplierId ? String(dados.supplierId) : "",
      quantity: dados.quantity,
    });
    setOpen(true);
    // Reposição é compra de produto cadastrado: a grade, a categoria e as fotos
    // dele valem aqui igual a quem escolhe pelo seletor.
    void loadProductGroup(dados.productGroupId);
  }

  function update<K extends keyof PurchaseForm>(field: K, value: PurchaseForm[K]) {
    markDirty();
    // Mexeu no preço, o número passa a ser dele: o cálculo de margem para de
    // repô-lo a cada mudança de custo.
    if (field === "suggestedPrice") setPrecoTocado(true);
    // O mesmo vale para o final, que até aqui acompanhava o bruto — mas só com
    // valor NOVO. O campo de moeda devolve o valor em todo blur, e passar por ele
    // com Tab não é decidir desconto: sem a comparação, corrigir o bruto depois
    // deixaria o final para trás e a compra gravaria um desconto que ninguém deu.
    if (field === "finalTotal" && value !== form.finalTotal) finalTocadoRef.current = true;
    const finalAcompanha = !finalTocadoRef.current;
    setForm((current) => {
      const next: PurchaseForm = { ...current, [field]: value };
      // O final nasce igual ao bruto e o acompanha até alguém editá-lo.
      if (field === "grossTotal" && finalAcompanha) next.finalTotal = next.grossTotal;
      return next;
    });
  }

  /**
   * O total bruto digitado. Com grade em rateio, as fatias das variações são
   * refeitas com os totais novos — o final incluído, quando ele acompanha o bruto.
   */
  function setGrossTotal(value: number) {
    update("grossTotal", value);
    if (variations.hasGrid) variations.refreshSplit(value, finalTocadoRef.current ? form.finalTotal : value);
  }

  /** O total final digitado: a partir daqui ele não acompanha mais o bruto. */
  function setFinalTotal(value: number) {
    update("finalTotal", value);
    if (variations.hasGrid) variations.refreshSplit(form.grossTotal, value);
  }

  /**
   * O custo de uma variação, em modo manual. Sem desconto declarado na variação,
   * o bruto dela vai junto — ver `usePurchaseVariations.setItemCost`.
   */
  function setVariationCost(productId: number, value: number) {
    variations.setItemCost(productId, value);
  }

  /**
   * O campo de código mudou. Só existe sem produto vinculado, e a consulta ao
   * catálogo acontece depois da pausa do bipe.
   */
  function setProductBarcode(value: string) {
    update("productBarcode", value.trim() ? value : null);
    barcodeLookup.onBarcodeChange(value);
  }

  /**
   * Troca o departamento: a categoria escolhida sai junto.
   *
   * Mantê-la faria o par ficar incoerente — categoria de um departamento,
   * departamento de outro —, e a lista filtrada abaixo nem mostraria a que
   * continuou selecionada.
   */
  function setDepartment(departmentId: string) {
    markDirty();
    setForm((current) => ({ ...current, departmentId, categoryId: "" }));
  }

  /**
   * Vincula um produto já cadastrado: o nome passa a ser o do cadastro.
   *
   * O GRUPO viaja junto porque é ele que carrega as variações irmãs — escolher
   * uma cor na busca abre a grade do produto inteiro. A grade em si é montada
   * pelo `usePurchaseVariations` quando a lista chega.
   *
   * **As fotos passam a ser as do produto** (13/09/2026), junto com a categoria.
   * Escolher o produto é dizer "a compra é disto", e disto o sistema já sabe a
   * foto. Foto que estivesse no formulário antes da escolha é substituída: a
   * regra da modal é uma só — o que está aqui é a galeria do grupo escolhido —,
   * e o seletor de produto fica acima do campo de fotos justamente porque ele
   * vem primeiro.
   */
  function selectProduct(product: ProductSearchOption) {
    // Vínculo NOVO — a compra estava como produto novo — em cima de nome
    // digitado ou foto anexada: pergunta antes de substituir. Trocar de produto
    // já vinculado não pergunta: o que está na tela é a galeria do produto
    // ANTERIOR, não trabalho de ninguém.
    if (!purchaseHasProduct(form) && purchaseDataWouldBeReplaced(form, product.name)) {
      setPendingProduct(product);
      return;
    }
    applyProduct(product, false);
  }

  /**
   * Grava o vínculo no formulário.
   *
   * `manterFotos` é a resposta do operador quando havia foto na compra: com ele
   * a galeria do formulário fica como está e, no salvar, SUBSTITUI a do produto
   * — que é o que a galeria única de 13/09/2026 significa. O nome não tem essa
   * escolha: com produto vinculado ele é sempre o do catálogo, aqui e no backend.
   */
  function applyProduct(product: ProductSearchOption, manterFotos: boolean) {
    markDirty();
    const mesmoGrupo = form.productGroupId === product.productGroupId;

    setForm((current) => ({
      ...current,
      productId: product.id,
      productGroupId: product.productGroupId,
      productName: product.name,
      productBarcode: product.barcode,
      productPrice: product.price,
      // A grade do grupo anterior não vale para o novo.
      items: mesmoGrupo ? current.items : [],
    }));

    // Trocar de variação dentro do MESMO grupo não muda foto nem categoria.
    if (!mesmoGrupo) void loadProductGroup(product.productGroupId, manterFotos);
  }

  /**
   * O código digitado já é de um produto cadastrado: a compra passa a ser dele,
   * pelo mesmo caminho do campo "Produto já cadastrado" (24/09/2026).
   *
   * Havendo o que perder — nome digitado ou foto anexada —, a mesma pergunta da
   * busca. Sem nada a perder, vincula direto e AVISA: a tela trocou de assunto
   * sozinha, e quem bipou precisa saber por quê.
   */
  function selectProductByBarcode(product: ProductSearchOption, code: string) {
    if (purchaseDataWouldBeReplaced(form, product.name)) {
      setPendingBarcode(code);
      setPendingProduct(product);
      return;
    }
    applyProduct(product, false);
    toast({
      title: "Produto já cadastrado",
      description: `O código ${code} é de ${product.name}. A compra foi vinculada a ele.`,
    });
  }

  /** "Usar os dados do produto": o caminho de sempre. */
  function confirmProductWithGallery() {
    if (!pendingProduct) return;
    applyProduct(pendingProduct, false);
    setPendingProduct(null);
    setPendingBarcode(null);
  }

  /** "Manter as fotos desta compra": elas passam a valer no produto ao salvar. */
  function confirmProductKeepingImages() {
    if (!pendingProduct) return;
    applyProduct(pendingProduct, true);
    setPendingProduct(null);
    setPendingBarcode(null);
  }

  /**
   * Fecha a pergunta sem vincular nada — o formulário fica como estava, menos o
   * código que disparou a pergunta, quando foi ele: esse código já é do produto
   * recusado e não pode ser o de um cadastro novo.
   */
  function cancelProductSelection() {
    if (pendingBarcode !== null) {
      const codigo = pendingBarcode;
      setForm((current) =>
        current.productBarcode !== null && resolveBarcodeInput(current.productBarcode).code === codigo
          ? { ...current, productBarcode: null }
          : current,
      );
    }
    setPendingProduct(null);
    setPendingBarcode(null);
  }

  /**
   * Tira o vínculo e libera o nome para digitação (produto novo).
   *
   * As fotos saem junto: elas eram a galeria daquele produto, e deixá-las viraria
   * a galeria de um cadastro novo com as fotos de outro item. O nome fica, para
   * servir de ponto de partida; a categoria também, porque quase sempre é a
   * mesma do que estava vinculado — e agora ela é editável.
   */
  function clearProduct() {
    markDirty();
    setForm((current) => ({
      ...current,
      productId: null,
      productGroupId: null,
      productBarcode: null,
      productPrice: null,
      items: [],
      images: [],
    }));
  }

  /**
   * Pedido de fechar vindo da tela — clique no fundo, Esc, o X e o "Cancelar".
   *
   * Com algo digitado, pergunta antes de descartar, como a tela de produto já
   * fazia. O clique no fundo era o caso real: a modal fechava e levava junto o
   * formulário inteiro — fornecedor, quantidade, totais, as fotos que acabaram
   * de subir —, sem nada explicando o que tinha acontecido.
   *
   * Compra lançada abre em leitura e não tem o que perder: fecha direto.
   */
  function requestClose() {
    if (dirty && !readOnly) {
      setDiscardOpen(true);
      return;
    }
    setOpen(false);
  }

  /** "Descartar e sair": fecha de verdade. */
  function confirmDiscard() {
    setOpen(false);
  }

  /** "Continuar editando": some a pergunta e o formulário fica como estava. */
  function cancelDiscard() {
    setDiscardOpen(false);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: SavePurchasePayload) =>
      editingId ? updatePurchase(editingId, payload) : createPurchase(payload),
    onSuccess: async (_compra, payload) => {
      // Só a compra NOVA vira memória: editar uma compra antiga não diz nada
      // sobre a próxima que vai ser lançada. Nota apagada também é lembrada —
      // o novo padrão é "sem nota".
      if (!editingId) rememberPurchaseDefaults(userId, purchaseDefaultsFromPayload(payload));
      await onSaved();
      setOpen(false);
      toast({ title: editingId ? "Compra atualizada" : "Compra registrada" });
    },
    onError: (error: unknown) =>
      toast({
        title: "Erro ao salvar a compra",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      }),
  });

  // O departamento sai da CATEGORIA, e o catálogo de categorias pode chegar
  // DEPOIS da compra: quem abre `/estoque/compras?compra=5` direto no navegador
  // caía numa modal com a categoria certa e o departamento em branco — e a lista
  // de categorias, que o departamento filtra, aparecia inteira. Ajuste durante o
  // render, como o preço abaixo: a condição se desfaz sozinha depois dele.
  const departamentoDaCategoria = departmentOfCategory(Number(form.categoryId) || null, categories);
  if (open && form.categoryId && !form.departmentId && departamentoDaCategoria) {
    setForm((current) => ({ ...current, departmentId: departamentoDaCategoria }));
  }

  // O preço sugerido nasce do CÁLCULO DE MARGEM (custo ÷ 0,6, arredondado para
  // cima ao múltiplo de R$ 0,10) assim que o custo unitário existe, e continua
  // editável. É ajuste durante o RENDER, e não efeito: a condição se desfaz
  // sozinha depois do ajuste, e num efeito seria preciso guardar "já sugeri
  // para este custo" só para não repor o número em cima do que foi digitado.
  const custoUnitario = derivePurchaseTotals(form.quantity, form.grossTotal, form.finalTotal).unitFinal;
  const precoPelaMargem = suggestedPrice(custoUnitario) ?? 0;
  if (open && !readOnly && !precoTocado && form.suggestedPrice !== precoPelaMargem) {
    setForm((current) => ({ ...current, suggestedPrice: precoPelaMargem }));
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();

    if (readOnly) return;

    if (loadingGroup) {
      toast({
        title: "Aguarde",
        description: "As fotos e a categoria do produto ainda estão carregando.",
        variant: "warning",
      });
      return;
    }

    const problem = validatePurchaseForm(form, supplier);
    if (problem) {
      toast({ title: "Atenção", description: problem, variant: "warning" });
      return;
    }

    saveMutation.mutate({
      supplierId: Number(form.supplierId),
      productId: form.productId,
      // Com produto vinculado o backend usa a do grupo e ignora esta.
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      productName: form.productName.trim(),
      // Com produto vinculado o código é o do cadastro, e o backend ignora este.
      productBarcode: purchaseHasProduct(form) ? null : form.productBarcode?.trim() || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      details: form.details.trim() || null,
      purchaseLink: form.purchaseLink.trim() || null,
      // Instante LOCAL sem fuso, como a entrada de estoque: a coluna é
      // `timestamp without time zone`, e `toISOString()` jogaria o dia para trás.
      purchaseDate: `${form.purchaseDate}T00:00:00`,
      quantity: form.quantity,
      grossTotal: form.grossTotal,
      finalTotal: form.finalTotal,
      suggestedPrice: form.suggestedPrice > 0 ? form.suggestedPrice : null,
      status: Number(form.status),
      // Com produto vinculado esta lista VIRA a galeria do grupo, na mesma
      // transação. Ver `SavePurchasePayload.imageIds`.
      imageIds: form.images.map((image) => image.imageId),
      // Sem grade a lista é vazia, e o backend trata o corpo como o de sempre:
      // a compra de um produto só, descrita pelo CABEÇALHO — que é onde mora o
      // campo de quantidade que o operador acabou de editar.
      items: form.items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          grossTotal: item.grossTotal,
          finalTotal: item.finalTotal,
        })),
      costSplitManual: form.costSplitManual,
    });
  }

  return {
    open,
    setOpen,
    /** Fechar pedido pela tela: pergunta antes quando há o que perder. */
    requestClose,
    dirty,
    discardOpen,
    confirmDiscard,
    cancelDiscard,
    editingId,
    readOnly,
    form,
    supplier,
    linkRequired: purchaseLinkIsRequired(form, supplier),
    costRequired: purchaseCostIsRequired(form),
    categoryLocked: purchaseCategoryIsLocked(form),
    /** As categorias do departamento escolhido — a lista que o select mostra. */
    categories: form.departmentId
      ? categories.filter((item) => String(item.departmentId) === form.departmentId)
      : categories,
    loadingGroup,
    update,
    setGrossTotal,
    setFinalTotal,
    setVariationCost,
    setProductBarcode,
    /** Enter ou saída do campo de código: procura na hora. */
    commitProductBarcode: barcodeLookup.onBarcodeCommit,
    searchingBarcode: barcodeLookup.searchingBarcode,
    /**
     * A data do formulário veio da memória e não é hoje — a tela pede para
     * conferir. Some quando a pessoa troca a data.
     */
    dateFromMemory: dataLembrada !== null && form.purchaseDate === dataLembrada,
    setDepartment,
    openNew,
    openEdit,
    openForRestock,
    selectProduct,
    clearProduct,
    /**
     * O produto escolhido à espera da resposta sobre nome e fotos, ou `null`.
     * Ver `purchaseDataWouldBeReplaced`.
     */
    pendingProduct,
    /** O código que achou o `pendingProduct`, quando a pergunta nasceu do campo de código. */
    pendingBarcode,
    confirmProductWithGallery,
    confirmProductKeepingImages,
    cancelProductSelection,
    // Fotos: quatro entradas (arquivo, colagem, URL e busca na web), todas pelo
    // mesmo funil de compressão e upload. Ver `usePurchaseImages`.
    ...images,
    // Grade de variações: existe só quando o grupo tem mais de uma.
    ...variations,
    submit,
    isSaving: saveMutation.isPending,
  };
}

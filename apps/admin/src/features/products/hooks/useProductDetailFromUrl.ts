import { useEffect, useRef, useState } from "react";
import { useToast } from "@workspace/ui";
import { getPurchase, type ProductDto, type PurchaseDto } from "@workspace/api-client-react";
import { PURCHASE_QUERY_PARAM } from "@/features/purchases/purchases-route";
import { getProductById, getProductsPage } from "@/services/products.service";
import { buildProductCollections } from "@/services/mappers";
import {
  useAllCategories,
  useAllDepartments,
  useAllImages,
  useAllProductGroups,
  useAllProductImages,
  useAllProductTags,
  useAllTags,
} from "@/hooks/use-catalog";
import {
  DETAIL_STOCK_PRODUCT_PARAM,
  DETAIL_TAB_PARAM,
  productDetailPathname,
  productGroupIdFromPathname,
} from "../product-detail-route";

/**
 * Abre a tela de detalhe de quem chega por link.
 *
 * São três formas de URL, e todas terminam no mesmo lugar — "abrir o grupo G":
 *
 * - **`/produtos/<grupo>/detalhes`** — a rota canônica, escrita pela própria
 *   tela enquanto o detalhe está aberto (`useProductDetailHistory`). É o link
 *   que a pessoa copia da barra de endereços.
 * - **`?id=<grupo>`** — o formato anterior à rota. Continua respondendo porque
 *   está em favorito e em aba aberta de gente que não recarregou.
 * - **`?editar=<produto>`** — o link do PDV e da tela de Etiquetas, que
 *   conhecem o id do PRODUTO (uma variação), não o do grupo. Ele é resolvido
 *   aqui, num `getProductById`.
 *
 * Chegando por uma das duas formas antigas, a URL é trocada pela canônica com
 * `replaceState` — sem entrada nova no histórico, porque a pessoa não navegou.
 *
 * ## Duas coisas que este hook faz questão de NÃO fazer
 *
 * **Não espera os catálogos para começar.** A busca do produto sai na montagem,
 * junto com eles; só a montagem final (`buildProductCollections`) precisa dos
 * sete. Esperar era uma ida ao servidor inteira de atraso — e as pesadas da
 * lista, `getAllImages` e `getAllProductImages`, são justamente as que não têm
 * nada a ver com descobrir qual produto abrir.
 *
 * **Não resolve pela LISTAGEM.** A versão anterior do link do PDV
 * (`?busca=&editar=`) procurava a linha na página 1 da listagem filtrada pelo
 * nome do grupo: se o termo não trouxesse o produto para aquela página, o link
 * falhava com um toast. Resolvendo o id no servidor, o filtro deixa de
 * participar da abertura — ele continua na URL só para a listagem embaixo já
 * aparecer filtrada quando a pessoa fechar o detalhe.
 */

/** Parâmetro do formato anterior à rota: id do GRUPO. */
const PARAM_ID_LEGADO = "id";

/** Parâmetro do link do PDV e das Etiquetas: id do PRODUTO. */
const PARAM_EDITAR = "editar";

/**
 * Parâmetro do "Lançar recebimento" de uma compra de produto NOVO: id da
 * COMPRA. Abre o cadastro em branco preenchido por ela (`openDetailFromPurchase`).
 */
const PARAM_COMPRA = PURCHASE_QUERY_PARAM;

/** Número inteiro positivo, ou `null` — ids nunca são outra coisa. */
function idValido(bruto: string | null): number | null {
  if (bruto === null) return null;
  const id = Number(bruto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** O que a URL de entrada pede. Lido UMA vez: a instrução é de uma vez só. */
type PedidoDaUrl = { tipo: "grupo" | "produto" | "compra"; id: number } | null;

function pedidoInicialDaUrl(): PedidoDaUrl {
  if (typeof window === "undefined") return null;

  const doCaminho = productGroupIdFromPathname(window.location.pathname);
  if (doCaminho !== null) return { tipo: "grupo", id: doCaminho };

  const params = new URLSearchParams(window.location.search);

  const grupoLegado = idValido(params.get(PARAM_ID_LEGADO));
  if (grupoLegado !== null) return { tipo: "grupo", id: grupoLegado };

  const produto = idValido(params.get(PARAM_EDITAR));
  if (produto !== null) return { tipo: "produto", id: produto };

  const compra = idValido(params.get(PARAM_COMPRA));
  if (compra !== null) return { tipo: "compra", id: compra };

  return null;
}

/** Tira os parâmetros de abertura da barra de endereços, preservando o resto. */
function urlSemParametrosDeAbertura(): URL {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM_ID_LEGADO);
  url.searchParams.delete(PARAM_EDITAR);
  url.searchParams.delete(PARAM_COMPRA);
  // A aba de abertura tambem e instrucao de uma vez so: deixada na URL, um F5
  // depois de a pessoa ter trocado de aba a devolveria para a de Estoque.
  url.searchParams.delete(DETAIL_TAB_PARAM);
  url.searchParams.delete(DETAIL_STOCK_PRODUCT_PARAM);
  return url;
}

/** Leva a barra de endereços para a rota canônica do grupo, sem navegar. */
function irParaRotaCanonica(productGroupId: number): void {
  const url = urlSemParametrosDeAbertura();
  const destino = `${productDetailPathname(productGroupId)}${url.search}${url.hash}`;
  if (destino === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;

  window.history.replaceState(null, "", destino);
}

/** Desiste da abertura e devolve a barra de endereços à listagem. */
function voltarParaListagem(): void {
  const url = urlSemParametrosDeAbertura();
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

type UseProductDetailFromUrlParams = {
  /**
   * `openDetail` do `useProductEditor`.
   *
   * `unknown` porque o produto vem do `buildProductCollections`, que devolve
   * `EnrichedProduct` — os DTOs completos —, e a tabela trabalha com
   * `ProductTableRow`. O `openDetail` lê os dois pelos campos que tem em comum;
   * apertar o tipo aqui exigiria inventar `productCount`, `uuid` e `version`.
   */
  openDetail: (product?: unknown) => void;
  /**
   * `openDetailFromPurchase` do `useProductEditor`: abre o cadastro NOVO
   * preenchido por uma compra. Opcional porque só a página de Produtos o tem.
   */
  openDetailFromPurchase?: (purchase: PurchaseDto) => void;
};

type UseProductDetailFromUrlResult = {
  /**
   * A URL pede um detalhe que ainda não abriu.
   *
   * A página usa isto para NÃO desenhar a listagem nesse intervalo. Sem isso,
   * quem colava o link via a listagem inteira aparecer e ser substituída um
   * instante depois — a tela prometia uma coisa e mostrava outra.
   */
  resolvendo: boolean;
};

export function useProductDetailFromUrl({
  openDetail,
  openDetailFromPurchase,
}: UseProductDetailFromUrlParams): UseProductDetailFromUrlResult {
  const [pedido] = useState(pedidoInicialDaUrl);
  const [resolvendo, setResolvendo] = useState(pedido !== null);
  const jaResolvido = useRef(false);
  const { toast } = useToast();

  const productGroups = useAllProductGroups();
  const categories = useAllCategories();
  const departments = useAllDepartments();
  const tags = useAllTags();
  const productTags = useAllProductTags();
  const images = useAllImages();
  const productImages = useAllProductImages();

  const catalogs = [productGroups, categories, departments, tags, productTags, images, productImages];
  const catalogsProntos = catalogs.every((query) => !query.isLoading);

  /**
   * O produto representante do grupo pedido, buscado UMA vez na montagem.
   *
   * Fica num ref, e não em estado, porque nada na tela depende dele até a hora
   * de abrir: o que a página precisa saber é só se ainda está resolvendo.
   */
  const buscaRef = useRef<Promise<ProdutoRepresentante | null> | null>(null);

  // Efeito SÓ para disparar a busca, sem `catalogsProntos` nas dependências —
  // é ele que faz o produto ser procurado em paralelo com os sete catálogos.
  // Dispará-la no corpo do componente seria mais curto e estaria errado: escrever
  // em ref durante o render é recusado pelo lint do React, e em modo estrito o
  // render acontece duas vezes — seriam duas requisições.
  useEffect(() => {
    // Compra não tem representante para buscar: o caminho dela é outro, abaixo.
    if (pedido === null || pedido.tipo === "compra" || buscaRef.current !== null) return;
    buscaRef.current = buscarRepresentante(pedido);
  }, [pedido]);

  useEffect(() => {
    if (pedido === null || jaResolvido.current || !catalogsProntos) return;

    let cancelado = false;
    jaResolvido.current = true;

    (async () => {
      if (pedido.tipo === "compra") {
        // Cadastro NOVO a partir da compra: não há grupo para virar rota
        // canônica — a URL volta para a listagem e a tela abre preenchida.
        const compra = await buscarCompra(pedido.id);
        if (cancelado) return;

        setResolvendo(false);
        voltarParaListagem();

        if (compra === null || !openDetailFromPurchase) {
          toast({
            title: "Compra não encontrada",
            description: "O id da URL não corresponde a nenhuma compra.",
            variant: "destructive",
          });
          return;
        }

        openDetailFromPurchase(compra);
        return;
      }

      // O efeito de cima roda primeiro (está declarado antes, no mesmo commit);
      // a busca própria aqui é só a rede de segurança dessa ordem.
      const encontrado = await (buscaRef.current ?? buscarRepresentante(pedido));
      if (cancelado) return;

      if (encontrado === null) {
        setResolvendo(false);
        voltarParaListagem();
        // Silenciar aqui seria o pior desfecho: a pessoa clicou em "editar", a
        // aba abriu numa listagem e nada explica por que o detalhe não veio.
        toast({
          title: "Produto não encontrado",
          description: "O id da URL não corresponde a nenhum produto.",
          variant: "destructive",
        });
        return;
      }

      const { enrichedProducts } = buildProductCollections({
        products: [encontrado.produto],
        productGroups: productGroups.data ?? [],
        categories: categories.data ?? [],
        departments: departments.data ?? [],
        tags: tags.data ?? [],
        productTags: productTags.data ?? [],
        images: images.data ?? [],
        productImages: productImages.data ?? [],
      });

      // A URL vira a canônica ANTES de abrir: o `useProductDetailHistory` olha
      // para ela ao abrir e, reconhecendo a entrada como já sendo a do detalhe,
      // não empurra outra — senão o voltar não sairia de lugar nenhum.
      irParaRotaCanonica(encontrado.productGroupId);
      setResolvendo(false);
      openDetail(enrichedProducts[0]);
    })();

    return () => {
      cancelado = true;
    };
    // `openDetail` é estável (declaração de função do hook) e os catálogos entram
    // pelos chaves de query, não pela identidade dos arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, catalogsProntos, openDetail, openDetailFromPurchase, toast]);

  return { resolvendo };
}

/** A compra que abre o cadastro novo. `null` cobre id inexistente e falha de rede, como o produto. */
async function buscarCompra(purchaseId: number): Promise<PurchaseDto | null> {
  try {
    return await getPurchase(purchaseId);
  } catch {
    return null;
  }
}

/** O produto que abre o detalhe, com o grupo a que ele pertence. */
type ProdutoRepresentante = {
  produto: ProductDto;
  productGroupId: number;
};

/**
 * Busca o produto que a URL pede, resolvendo o grupo quando o id é de produto.
 *
 * Devolve `null` — e não lança — para a falha de rede desembocar no mesmo aviso
 * do id inexistente: os dois são, para quem clicou, "o link não abriu".
 */
async function buscarRepresentante(pedido: NonNullable<PedidoDaUrl>): Promise<ProdutoRepresentante | null> {
  try {
    if (pedido.tipo === "produto") {
      const produto = await getProductById(pedido.id);
      return produto ? { produto, productGroupId: produto.productGroupId } : null;
    }

    // `?productGroupId=` vem ordenado por id decrescente: o primeiro é o
    // produto representante — o mesmo que a linha da tabela mostraria.
    const page = await getProductsPage({ productGroupId: pedido.id, page: 1, limit: 1 });
    const produto = page.data[0];
    return produto ? { produto, productGroupId: pedido.id } : null;
  } catch {
    return null;
  }
}

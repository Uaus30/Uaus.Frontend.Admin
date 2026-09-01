import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@workspace/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { getEnumOptions } from "@/services/core";

import { createImageFromFile, downloadWebImageAsFile } from "@/services/images.service";
import { upsertProduct, syncProductImages } from "@/services/products.service";

import { optimizeImage } from "@/lib/imageOptimizer";
import {
  PRODUCT_STATUS,
  STALE_TIME,
  useGetProductTable,
  type EnumOptionDto,
} from "@workspace/api-client-react";
import { useAllCategories, useAllDepartments, CATALOG_KEYS, RESOURCE_KEYS } from "@/hooks/use-catalog";
import { mapProductTableRow, toProductImageAssociations } from "./mapProductTableRow";
import type { ProductTableRow } from "../types";

/**
 * useProductTable
 *
 * Hook controlador da tabela de produtos: listagem paginada com busca, filtros
 * (departamento, categoria, status) e a edição de PREÇO direto na célula.
 *
 * A edição inline de preço existe porque corrigir preço é a operação mais
 * frequente da tela, e abrir a modal do produto para trocar um número era o
 * maior atrito do dia a dia. A de ESTOQUE foi removida em 31/08/2026: estoque
 * nasce de lote, e o lançamento simplificado (menu Estoque da linha e aba do
 * detalhe) pergunta custo e fornecedor — a célula editável gravava um ajuste
 * herdando o custo do último lote sem avisar.
 *
 * ## Por que a listagem virou UMA requisição (item 4.1)
 *
 * Este hook montava a página em CASCATA de quatro níveis, cada um esperando o
 * anterior:
 *
 * 1. `/ProductGroups` paginado — a página de grupos;
 * 2. `/Products?productGroupId=` — **uma requisição por grupo**;
 * 3. `/ProductTags?productId=` e `/ProductImages?productId=` — **duas por
 *    produto**;
 * 4. `/Images/{id}` — **uma por imagem distinta**.
 *
 * Mais os três catálogos completos (departamentos, categorias, etiquetas) só para
 * escrever nomes nas colunas. Numa página de 20 grupos com variações isso passava
 * de 200 requisições, e as quatro idas e voltas eram em SÉRIE: a primeira linha
 * só aparecia depois de todas. Como cada endpoint filtrava por um id de cada vez,
 * não havia conserto possível só no navegador — daí o endereço agregado
 * `GET /Products/table`, que devolve a linha pronta.
 *
 * Hoje a tela faz **duas** requisições: a página da tabela e o catálogo de status
 * (compartilhado e cacheado por 5 min).
 *
 * ## Virtualização: avaliada e descartada
 *
 * A tabela renderiza a página inteira de uma vez. O seletor oferece 20 (padrão),
 * 50 e 100 linhas — só o último passa da faixa em que virtualizar compensa, e
 * cada linha carrega menu de contexto, dropdown e hover card em portal, que
 * virtualização quebra de formas difíceis de perceber. Com a cascata removida, o
 * custo de uma linha voltou a ser só render. Se o seletor um dia oferecer 500,
 * refaça a conta.
 */
/**
 * Termo de busca vindo da URL (`/produtos?busca=...`).
 *
 * Existe para o PDV poder abrir esta tela já filtrada no produto que o operador
 * quer corrigir — sem isso, o link do balcão cairia numa lista sem filtro e a
 * pessoa teria que buscar de novo.
 *
 * Lido uma única vez, na montagem: depois disso quem manda é o campo de busca.
 * Reagir à URL continuamente desfaria o que o usuário digitasse.
 */
function initialSearchFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("busca")?.trim() ?? "";
}

export function useProductTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(initialSearchFromUrl);
  const debouncedSearch = useDebounce(search, 300);
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<number | undefined>(PRODUCT_STATUS.Active);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: rawDepartments = [] } = useAllDepartments();
  const { data: rawCategories = [] } = useAllCategories();

  const { data: rawStatusOptions = [] } = useQuery<EnumOptionDto[]>({
    queryKey: ["product-status-options"],
    queryFn: () => getEnumOptions("/Products/enums/product-status"),
    staleTime: STALE_TIME.catalogo,
    refetchOnWindowFocus: false,
  });

  const departments = useMemo(
    () => [...rawDepartments].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [rawDepartments],
  );

  const categories = useMemo(() => {
    const list = departmentId ? rawCategories.filter((c) => c.departmentId === departmentId) : rawCategories;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [rawCategories, departmentId]);

  const statusOptions = useMemo(
    () => [...rawStatusOptions].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [rawStatusOptions],
  );

  const handleSetDepartmentId = (newDeptId?: number) => {
    setDepartmentId(newDeptId);
    if (newDeptId && categoryId) {
      const cat = rawCategories.find((c) => c.id === categoryId);
      if (cat && cat.departmentId !== newDeptId) {
        setCategoryId(undefined);
      }
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setDepartmentId(undefined);
    setCategoryId(undefined);
    setStatus(PRODUCT_STATUS.Active);
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, departmentId, categoryId, status]);

  const { data: tablePage, isLoading } = useGetProductTable({
    search: debouncedSearch,
    departmentId,
    categoryId,
    status,
    page,
    limit,
  });

  /**
   * As linhas da página, já no vocabulário da tela.
   *
   * O nome `enrichedProducts` foi mantido porque é o que a página e a tabela
   * recebem por prop; o que mudou é a origem — antes era o cruzamento de cinco
   * consultas no navegador, agora é a resposta do servidor.
   */
  const enrichedProducts = useMemo<ProductTableRow[]>(
    () => (tablePage?.data ?? []).map(mapProductTableRow),
    [tablePage?.data],
  );

  const totalPages = Math.max(1, Math.ceil((tablePage?.total || 0) / limit));
  const [updatingPriceId, setUpdatingPriceId] = useState<number | null>(null);

  /**
   * Converte o status da linha no código numérico que o PUT espera.
   *
   * O backend serializa enum ora por nome ("Active"), ora por código, e o catálogo
   * de status é a tabela de tradução. Sem isso a edição de preço mandaria o status
   * como texto e o produto voltaria com status inválido.
   */
  const getStatusNumber = (statusVal: ProductTableRow["status"]): number => {
    if (statusVal === undefined || statusVal === null) return 0;
    const statusStr = String(statusVal);
    const option = statusOptions.find(
      (opt) =>
        String(opt.id) === statusStr ||
        opt.value.toLowerCase() === statusStr.toLowerCase() ||
        opt.name.toLowerCase() === statusStr.toLowerCase(),
    );
    return option ? option.id : Number(statusVal);
  };

  /**
   * Invalida o que a edição inline muda.
   *
   * `RESOURCE_KEYS.products` alcança a tabela (`["products","table", …]`) porque
   * ela vive sob o prefixo do recurso. O histórico do grupo entra à parte: é a
   * única chave que não está sob esse prefixo e a edição grava uma linha nele.
   */
  const invalidateAfterInlineEdit = async (productGroupId: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
      queryClient.invalidateQueries({ queryKey: ["product-group-history", productGroupId] }),
    ]);
  };

  /** Atualiza o preço de venda do produto direto na célula. */
  const updateProductPrice = async (product: ProductTableRow, newPrice: number) => {
    setUpdatingPriceId(product.id);
    try {
      // A linha exibe o nome do GRUPO; o PUT tem que devolver o nome do PRODUTO,
      // que vem separado em `productName`. Mandar o nome exibido renomeia o
      // produto silenciosamente, com registro no histórico.
      await upsertProduct({
        id: product.id,
        productGroupId: product.productGroupId,
        name: product.productName,
        description: product.description,
        barcode: product.barcode,
        price: newPrice,
        minStock: product.minStock,
        status: getStatusNumber(product.status),
      });
      await invalidateAfterInlineEdit(product.productGroupId);
      toast({
        title: "Preço atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar preco:", error);
      toast({
        title: "Erro ao atualizar preço",
        description: describeApiError(error),
        variant: "destructive",
      });
    } finally {
      setUpdatingPriceId(null);
    }
  };

  /**
   * Baixa, otimiza e associa uma imagem da web como a principal (índice 0) do
   * produto, preservando as imagens atuais dele.
   */
  const saveWebImageAsPrincipal = async (product: ProductTableRow, webImageUrl: string) => {
    // O download passa pelo services/images: o proxy e o tratamento de 401
    // ficam num lugar só, em vez de repetidos aqui e no editor.
    const file = await downloadWebImageAsFile(webImageUrl, product.name);

    const optimizedResult = await optimizeImage(file);
    if (optimizedResult.optimized) {
      toast({
        title: "Imagem otimizada",
        description: `${(optimizedResult.originalSize / 1024 / 1024).toFixed(2)}MB reduzido para ${(optimizedResult.optimizedSize / 1024).toFixed(0)}KB (economizou ${Math.round((1 - optimizedResult.optimizedSize / optimizedResult.originalSize) * 100)}%)`,
      });
    }

    const uploadedImage = await createImageFromFile({
      file: optimizedResult.file,
      name: product.name,
      type: 3,
    });

    // As associações atuais vêm da própria linha — antes custavam uma consulta a
    // `/ProductImages?productId=` por produto da página.
    const currentAssociations = toProductImageAssociations(product);

    const nextImages = [
      { imageId: uploadedImage.id, displayOrder: 0 },
      ...currentAssociations.map((association, idx) => ({
        imageId: association.imageId,
        displayOrder: idx + 1,
      })),
    ];

    await syncProductImages({
      productId: product.id,
      currentAssociations,
      nextImages,
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productImages }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.images }),
    ]);

    toast({
      title: "Imagem principal atualizada com sucesso!",
    });
  };

  return {
    search,
    setSearch,
    departmentId,
    setDepartmentId: handleSetDepartmentId,
    departments,
    categoryId,
    setCategoryId,
    categories,
    status,
    setStatus,
    statusOptions,
    resetFilters: handleResetFilters,
    page,
    setPage,
    limit,
    setLimit,
    isLoading,
    productPage: tablePage,
    enrichedProducts,
    totalPages,
    updatingPriceId,
    updateProductPrice,
    saveWebImageAsPrincipal,
  };
}

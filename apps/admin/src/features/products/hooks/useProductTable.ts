import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getEnumOptions } from "@/services/core";
import { buildProductCollections } from "@/services/mappers";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getAllImages, createImageFromFile, buildImageProxyUrl, getImagesPage } from "@/services/images.service";
import {
  getAllProducts,
  getAllProductImages,
  getAllProductTags,
  getProductGroupsPage,
  upsertProduct,
  adjustProductStock,
  syncProductImages,
} from "@/services/products.service";
import { getAllTags } from "@/services/tags.service";
import { optimizeImage } from "@/lib/imageOptimizer";
import { getAuthSession, apiGet, type ImageDto } from "@workspace/api-client-react";

/**
 * useProductTable
 * 
 * Orchestrator hook for managing the state, search queries, pagination, 
 * data mapping, and inline catalog modifications of the Product Table grid.
 * 
 * Core responsibilities:
 * - Querying product groups page dynamically by search, page index, and limits.
 * - Loading and mapping relational attributes (Departments, Categories, Tags, Images).
 * - Exposing inline cell editors for Price (`updateProductPrice`) and Stock (`updateProductStock`).
 * - Validating state edits and invalidating queries on completion.
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
  const [search, setSearch] = useState(initialSearchFromUrl);
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-all-for-products"],
    queryFn: () => getAllDepartments(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all-for-products"],
    queryFn: () => getAllCategories(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags-all-for-products"],
    queryFn: () => getAllTags(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: statusOptions = [] } = useQuery({
    queryKey: ["product-status-options"],
    queryFn: () => getEnumOptions("/Products/enums/product-status"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Query: Paginated ProductGroup catalog
  const { data: groupPage, isLoading: isGroupLoading } = useQuery({
    queryKey: ["product-groups-page", { search: debouncedSearch, page, limit }],
    queryFn: () => getProductGroupsPage({ search: debouncedSearch, page, limit }),
  });

  const pageGroups = groupPage?.data ?? [];
  const groupIds = pageGroups.map((g) => g.id);

  const productsQueries = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ["products-by-group", id],
      queryFn: () => getAllProducts({ productGroupId: id }),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const allProducts = productsQueries.flatMap((q) => q.data ?? []);
  const productIds = allProducts.map((p) => p.id);

  const productTagsQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ["tags-by-product", id],
      queryFn: () => getAllProductTags({ productId: id }),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const productTags = productTagsQueries.flatMap((q) => q.data ?? []);

  const productImagesQueries = useQueries({
    queries: productIds.map((id) => ({
      queryKey: ["images-by-product", id],
      queryFn: () => getAllProductImages({ productId: id }),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const productImages = productImagesQueries.flatMap((q) => q.data ?? []);
  const imageIds = Array.from(new Set(productImages.map((pi) => pi.imageId)));

  const imagesCatalogQueries = useQueries({
    queries: imageIds.map((id) => ({
      queryKey: ["image-by-id", id],
      queryFn: () => apiGet<ImageDto>(`/Images/${id}`).catch(() => null),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const imagesCatalog = imagesCatalogQueries
    .map((q) => q.data)
    .filter((img): img is ImageDto => img !== null && img !== undefined);

  const isLoading =
    isGroupLoading ||
    productsQueries.some((q) => q.isLoading) ||
    productTagsQueries.some((q) => q.isLoading) ||
    productImagesQueries.some((q) => q.isLoading) ||
    imagesCatalogQueries.some((q) => q.isLoading);

  /**
   * Enriches list of product groups to build display model representation.
   * Maps representatives products for variation group details.
   */
  const enrichedProducts = useMemo(() => {
    const pageGroups = groupPage?.data ?? [];
    
    const representativeProducts = pageGroups.map(group => {
      const firstProduct = allProducts.find(p => p.productGroupId === group.id);
      if (firstProduct) return firstProduct;
      
      // Fallback fallback if group has no child products
      return {
        id: 0,
        productGroupId: group.id,
        name: group.name,
        description: group.description,
        barcode: "",
        price: 0,
        costPrice: 0,
        stock: 0,
        minStock: 0,
        status: 1,
        canDelete: true,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      };
    });

    const allEnriched = buildProductCollections({
      products: representativeProducts,
      productGroups: pageGroups,
      categories,
      departments,
      tags,
      productTags,
      images: imagesCatalog,
      productImages,
    }).enrichedProducts;

    // Normalizes names to match the group name in UI
    return allEnriched.map(item => ({
      ...item,
      name: item.productGroup?.name || item.name
    }));
  }, [
    categories,
    departments,
    imagesCatalog,
    groupPage?.data,
    allProducts,
    productImages,
    productTags,
    tags,
  ]);

  const totalPages = Math.max(1, Math.ceil((groupPage?.total || 0) / limit));
  const queryClient = useQueryClient();
  const [updatingPriceId, setUpdatingPriceId] = useState<number | null>(null);

  /** Helper: Maps status field dynamic inputs into numeric value */
  const getStatusNumber = (statusVal: any): number => {
    if (statusVal === undefined || statusVal === null) return 0;
    const statusStr = String(statusVal);
    const option = statusOptions.find(
      opt =>
        String(opt.id) === statusStr ||
        opt.value.toLowerCase() === statusStr.toLowerCase() ||
        opt.name.toLowerCase() === statusStr.toLowerCase()
    );
    return option ? option.id : Number(statusVal);
  };

  /**
   * Mutation: Updates product selling price inline.
   */
  const updateProductPrice = async (product: any, newPrice: number) => {
    setUpdatingPriceId(product.id);
    try {
      // `product` vem de enrichedProducts, que troca o nome pelo nome do GRUPO
      // para exibição; enviar esse nome no PUT renomearia o produto (com
      // registro no histórico). O nome verdadeiro sai de allProducts.
      const original = allProducts.find((item) => item.id === product.id);
      await upsertProduct({
        id: product.id,
        productGroupId: product.productGroupId,
        name: original?.name ?? product.name,
        description: original?.description ?? product.description,
        barcode: original?.barcode ?? product.barcode,
        price: newPrice,
        minStock: original?.minStock ?? product.minStock,
        status: getStatusNumber(original?.status ?? product.status),
      });
      await Promise.all([
        // A linha da tabela lê preço/estoque de ["products-by-group"], não do
        // grupo paginado; sem invalidar essa chave o valor editado só aparecia
        // depois do staleTime de 5 min.
        queryClient.invalidateQueries({ queryKey: ["products-by-group", product.productGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["product-groups-page"] }),
        queryClient.invalidateQueries({ queryKey: ["product-group-history", product.productGroupId] }),
      ]);
      toast({
        title: "Preço atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar preco:", error);
      toast({
        title: "Erro ao atualizar preço",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
        error,
      });
    } finally {
      setUpdatingPriceId(null);
    }
  };

  const [updatingStockId, setUpdatingStockId] = useState<number | null>(null);

  /**
   * Mutation: Updates product stock level inline.
   * Note: The stock can only be increased manually according to system constraints.
   */
  const updateProductStock = async (product: any, newStock: number) => {
    if (newStock < product.stock) {
      toast({
        title: "Ajuste de estoque inválido",
        description: "O estoque só pode ser aumentado manualmente.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingStockId(product.id);
    try {
      await adjustProductStock(product.id, newStock);
      await Promise.all([
        // A linha da tabela lê preço/estoque de ["products-by-group"], não do
        // grupo paginado; sem invalidar essa chave o valor editado só aparecia
        // depois do staleTime de 5 min.
        queryClient.invalidateQueries({ queryKey: ["products-by-group", product.productGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["product-groups-page"] }),
        queryClient.invalidateQueries({ queryKey: ["product-group-history", product.productGroupId] }),
      ]);
      toast({
        title: "Estoque atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao atualizar estoque:", error);
      toast({
        title: "Erro ao atualizar estoque",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
        error,
      });
    } finally {
      setUpdatingStockId(null);
    }
  };

  /**
   * Baixa, otimiza e associa uma imagem da web como a principal (índice 0) do produto,
   * preservando as imagens atuais dele.
   */
  const saveWebImageAsPrincipal = async (product: any, webImageUrl: string) => {
    const proxyUrl = buildImageProxyUrl(webImageUrl);
    const session = getAuthSession();
    const headers: Record<string, string> = {};
    if (session?.token.value) {
      headers["Authorization"] = `Bearer ${session.token.value}`;
    }
    const response = await fetch(proxyUrl, { headers });
    if (!response.ok) {
      throw new Error(`Falha ao baixar imagem: ${response.statusText}`);
    }
    const blob = await response.blob();
    const cleanName = product.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const file = new File([blob], `${cleanName}.jpg`, { type: blob.type });

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

    const currentAssociations = productImages
      .filter((pi) => pi.productId === product.id)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const nextImages = [
      { imageId: uploadedImage.id, displayOrder: 0 },
      ...currentAssociations.map((pi, idx) => ({
        imageId: pi.imageId,
        displayOrder: idx + 1,
      })),
    ];

    await syncProductImages({
      productId: product.id,
      currentAssociations,
      nextImages,
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["product-images-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["images-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["product-groups-page"] }),
      queryClient.invalidateQueries({ queryKey: ["images-by-product", product.id] }),
    ]);

    toast({
      title: "Imagem principal atualizada com sucesso!",
    });
  };

  return {
    search,
    setSearch,
    page,
    setPage,
    limit,
    setLimit,
    isLoading,
    productPage: groupPage,
    enrichedProducts,
    totalPages,
    statusOptions,
    updatingPriceId,
    updateProductPrice,
    updatingStockId,
    updateProductStock,
    saveWebImageAsPrincipal,
  };
}

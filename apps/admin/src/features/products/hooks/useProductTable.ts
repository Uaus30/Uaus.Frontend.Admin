import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getEnumOptions } from "@/services/core";
import { buildProductCollections } from "@/services/mappers";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getAllImages } from "@/services/images.service";
import {
  getAllProducts,
  getAllProductImages,
  getAllProductTags,
  getProductGroupsPage,
  upsertProduct,
  adjustProductStock,
} from "@/services/products.service";
import { getAllTags } from "@/services/tags.service";

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
export function useProductTable() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // React Queries: Load full relation pools
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-all-for-products"],
    queryFn: () => getAllDepartments(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all-for-products"],
    queryFn: () => getAllCategories(),
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products-all-for-table"],
    queryFn: () => getAllProducts(),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags-all-for-products"],
    queryFn: () => getAllTags(),
  });

  const { data: productTags = [] } = useQuery({
    queryKey: ["product-tags-all-for-products"],
    queryFn: () => getAllProductTags(),
  });

  const { data: productImages = [] } = useQuery({
    queryKey: ["product-images-all-for-products"],
    queryFn: () => getAllProductImages(),
  });

  const { data: imagesCatalog = [] } = useQuery({
    queryKey: ["images-all-for-products"],
    queryFn: () => getAllImages(),
  });

  const { data: statusOptions = [] } = useQuery({
    queryKey: ["product-status-options"],
    queryFn: () => getEnumOptions("/Products/enums/product-status"),
  });

  // Query: Paginated ProductGroup catalog
  const { data: groupPage, isLoading } = useQuery({
    queryKey: ["product-groups-page", { search, page, limit }],
    queryFn: () => getProductGroupsPage({ search, page, limit }),
  });

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
      await upsertProduct({
        id: product.id,
        productGroupId: product.productGroupId,
        name: product.name,
        description: product.description,
        barcode: product.barcode,
        price: newPrice,
        minStock: product.minStock,
        status: getStatusNumber(product.status),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products-all-for-table"] }),
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
        queryClient.invalidateQueries({ queryKey: ["products-all-for-table"] }),
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
  };
}

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEnumOptions } from "@/services/core";
import { buildProductCollections } from "@/services/mappers";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getAllImages } from "@/services/images.service";
import {
  getAllProducts,
  getAllProductImages,
  getAllProductTags,
  getProductGroupsPage,
} from "@/services/products.service";
import { getAllTags } from "@/services/tags.service";

export function useProductTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

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

  const { data: groupPage, isLoading } = useQuery({
    queryKey: ["product-groups-page", { search, page, limit }],
    queryFn: () => getProductGroupsPage({ search, page, limit }),
  });

  const enrichedProducts = useMemo(() => {
    const pageGroups = groupPage?.data ?? [];
    
    // Para cada grupo, vamos encontrar o primeiro produto correspondente para extrair preço, estoque, imagens
    const representativeProducts = pageGroups.map(group => {
      const firstProduct = allProducts.find(p => p.productGroupId === group.id);
      if (firstProduct) return firstProduct;
      
      // Fallback: Mock product if group has no products yet
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

    // Fix names to display the group name in the table
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
  };
}

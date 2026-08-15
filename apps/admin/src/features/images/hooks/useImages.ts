import { useState, useMemo, useRef, useEffect } from "react";
import { useDebounce } from "@workspace/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { buildPublicImageUrl, getEnumOptions } from "@/services/core";
import {
  createImageFromFile,
  deleteImage,
  getAllImages,
  getImagesPage,
  updateImageRecord,
} from "@/services/images.service";
import type { CatalogImage } from "../types";
import { optimizeImage } from "@/lib/imageOptimizer";

/**
 * useImages
 * 
 * Custom hook centralizing state, forms, copy-to-clipboard,
 * upload mutations, rename updates, and list querying for the Images section.
 */
export function useImages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Estados dos modais
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  // Estados do formulário de upload
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Estado da cópia de URL
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Estados de renomeação
  const [renameImage, setRenameImage] = useState<CatalogImage | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Query: Carregar tipos de imagem cadastrados nos enums
  const { data: imageTypes = [] } = useQuery({
    queryKey: ["image-type-options"],
    queryFn: () => getEnumOptions("/Images/enums/image-type"),
  });

  const selectableTypes = useMemo(() => imageTypes.filter((item) => item.allowSelect), [imageTypes]);

  // O endpoint GET /Images só aceita search/page/size — não há filtro de tipo
  // no servidor. Filtrar no cliente apenas a página corrente mentia: a grade
  // ficava vazia com o total/paginação do conjunto SEM filtro. Com um tipo
  // selecionado, o catálogo completo é carregado e o recorte + paginação
  // passam a ser locais, refletindo o filtro de verdade.
  const typeFilterActive = typeFilter !== "all";

  // Query: Busca as imagens paginadas do backend
  const { data: serverPage, isLoading: isLoadingServerPage } = useQuery({
    queryKey: ["images-page", { search: debouncedSearch, page, limit, typeFilter }],
    queryFn: () =>
      getImagesPage({
        search: debouncedSearch, page, limit }),
    enabled: !typeFilterActive,
  });

  // Query: Catálogo completo, usado apenas enquanto há filtro de tipo ativo
  const { data: allImages = [], isLoading: isLoadingAllImages } = useQuery({
    queryKey: ["images-all-by-type", { search: debouncedSearch }],
    queryFn: () => getAllImages({ search: debouncedSearch || undefined }),
    enabled: typeFilterActive,
  });

  // Recorte completo por tipo (todas as páginas)
  const typeFilteredImages = useMemo(
    () => (allImages as CatalogImage[]).filter((item) => String(item.type) === typeFilter),
    [allImages, typeFilter],
  );

  // Página corrente exibida na grade
  const filteredImages = useMemo(() => {
    if (!typeFilterActive) return serverPage?.data ?? [];
    const startIndex = (page - 1) * limit;
    return typeFilteredImages.slice(startIndex, startIndex + limit);
  }, [limit, page, serverPage?.data, typeFilterActive, typeFilteredImages]);

  // Página "virtual" com total honesto quando o filtro de tipo está ativo
  const imagePage = useMemo(() => {
    if (!typeFilterActive) return serverPage;
    return {
      data: filteredImages,
      total: typeFilteredImages.length,
      page,
      limit,
    };
  }, [filteredImages, limit, page, serverPage, typeFilterActive, typeFilteredImages.length]);

  const isLoading = typeFilterActive ? isLoadingAllImages : isLoadingServerPage;

  /** Troca o tipo filtrado voltando para a primeira página (o recorte muda por inteiro). */
  function handleTypeFilterChange(value: string) {
    setTypeFilter(value);
    setPage(1);
  }

  /**
   * Reseta os estados do formulário de upload para valores padrões.
   */
  function resetUploadForm() {
    setFormName("");
    setFormType(selectableTypes[0]?.id.toString() ?? "");
    setFile(null);
    setPreview(null);
  }

  /**
   * Monitora a seleção de arquivos para upload, deduzindo o nome original e gerando preview,
   * aplicando otimização/compressão de imagem antes de atualizar o estado.
   */
  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    const result = await optimizeImage(selected);
    if (result.optimized) {
      toast({
        title: "Imagem otimizada",
        description: `${(result.originalSize / 1024 / 1024).toFixed(2)}MB reduzido para ${(result.optimizedSize / 1024).toFixed(0)}KB (economizou ${Math.round((1 - result.optimizedSize / result.originalSize) * 100)}%)`,
      });
    }

    setFile(result.file);
    if (!formName) {
      setFormName(result.file.name.replace(/\.[^/.]+$/, ""));
    }
    setPreview(URL.createObjectURL(result.file));
  }

  /**
   * Envia a imagem e seus metadados para a API do backend.
   */
  async function handleUpload() {
    if (!file || !formName || !formType) return;

    setUploading(true);
    try {
      await createImageFromFile({
        file,
        name: formName.trim(),
        type: Number(formType),
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["images-page"] }),
        queryClient.invalidateQueries({ queryKey: ["images-all-by-type"] }),
      ]);
      toast({ title: "Imagem salva com sucesso." });
      setUploadOpen(false);
      resetUploadForm();
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  /**
   * Inicia o fluxo de renomeação de uma imagem específica.
   */
  function handleRenameOpen(image: CatalogImage) {
    setRenameImage(image);
    setRenameName(image.name);
    setRenameOpen(true);
  }

  /**
   * Confirma e envia a requisição de alteração de nome da imagem.
   */
  async function handleRename() {
    if (!renameImage || !renameName.trim()) return;

    setRenaming(true);
    try {
      await updateImageRecord({
        id: renameImage.id,
        name: renameName.trim(),
        type: renameImage.type,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["images-page"] }),
        queryClient.invalidateQueries({ queryKey: ["images-all-by-type"] }),
      ]);
      toast({ title: "Nome atualizado." });
      setRenameOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao renomear",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRenaming(false);
    }
  }

  /**
   * Exclui uma imagem do sistema pelo ID.
   */
  async function handleDelete(id: number) {
    try {
      await deleteImage(id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["images-page"] }),
        queryClient.invalidateQueries({ queryKey: ["images-all-by-type"] }),
      ]);
      toast({ title: "Imagem removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover imagem",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  }

  /**
   * Copia a URL pública e absoluta da imagem para o clipboard da área de transferência.
   */
  function copyUrl(id: number, url: string) {
    navigator.clipboard.writeText(buildPublicImageUrl(url));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const totalPages = Math.max(1, Math.ceil((imagePage?.total || 0) / limit));

  return {
    search,
    setSearch,
    typeFilter,
    setTypeFilter: handleTypeFilterChange,
    page,
    setPage,
    limit,
    setLimit,
    uploadOpen,
    setUploadOpen,
    formName,
    setFormName,
    formType,
    setFormType,
    file,
    setFile,
    preview,
    setPreview,
    uploading,
    copiedId,
    renameOpen,
    setRenameOpen,
    renameImage,
    setRenameImage,
    renameName,
    setRenameName,
    renaming,
    imageTypes,
    selectableTypes,
    imagePage,
    isLoading,
    filteredImages,
    totalPages,
    resetUploadForm,
    handleFileChange,
    handleUpload,
    handleRenameOpen,
    handleRename,
    handleDelete,
    copyUrl,
  };
}

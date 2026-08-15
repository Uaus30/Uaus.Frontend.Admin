import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { ScrollArea } from "@workspace/ui";
import { Loader2, Search, Globe, AlertTriangle } from "lucide-react";
import React, { useState, useEffect } from "react";
import { searchInternetImages, type ImageSearchResult } from "@/services/images.service";
import { useToast } from "@workspace/ui";

/**
 * Propriedades para o componente ProductImageSearchModal.
 */
type ProductImageSearchModalProps = {
  /** Nome do produto usado como termo de busca padrão */
  productName: string;
  /** Código de barras do produto para buscas diretas ou enriquecidas */
  barcode?: string;
  /** Estado de visibilidade do modal */
  isOpen: boolean;
  /** Callback para alternar a exibição do modal */
  onOpenChange: (open: boolean) => void;
  /** Callback acionada ao selecionar uma imagem da web, responsável pelo download/otimização */
  onSelectImage: (imageUrl: string) => Promise<void> | void;
};

/**
 * ProductImageSearchModal
 * 
 * Componente modal desacoplado para consulta e seleção de imagens da internet.
 * Realiza buscas baseadas no nome e código de barras do produto e permite
 * selecionar a imagem desejada aplicando as regras de otimização.
 */
export function ProductImageSearchModal({
  productName,
  barcode,
  isOpen,
  onOpenChange,
  onSelectImage,
}: ProductImageSearchModalProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [images, setImages] = useState<ImageSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [limit, setLimit] = useState(6);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [submittingUrl, setSubmittingUrl] = useState<string | null>(null);

  // Inicializa o termo de busca padrão
  useEffect(() => {
    if (isOpen) {
      const defaultSearch = `${productName} ${barcode || ""}`.trim();
      setSearchTerm(defaultSearch);
      setLimit(6);
      setSelectedUrl(null);
      setSubmittingUrl(null);
      if (defaultSearch) {
        void fetchImages(defaultSearch, 6);
      }
    } else {
      setImages([]);
    }
  }, [isOpen, productName, barcode]);

  const fetchImages = async (query: string, currentLimit: number) => {
    setIsLoading(true);
    try {
      const results = await searchInternetImages(query, currentLimit);
      setImages(results);
    } catch (error) {
      console.error("Erro ao buscar imagens:", error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível carregar as imagens da internet.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setLimit(6);
    void fetchImages(searchTerm.trim(), 6);
  };

  const handleFetchMore = () => {
    const nextLimit = limit + 3;
    setLimit(nextLimit);
    void fetchImages(searchTerm.trim(), nextLimit);
  };

  const handleSelect = async (img: ImageSearchResult) => {
    setSubmittingUrl(img.imageUrl);
    setSelectedUrl(img.imageUrl);
    try {
      await onSelectImage(img.imageUrl);
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao selecionar imagem:", error);
      toast({
        title: "Erro ao processar imagem",
        description: error instanceof Error ? error.message : "Erro desconhecido.",
        variant: "destructive",
      });
      setSelectedUrl(null);
    } finally {
      setSubmittingUrl(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] border-border/50 bg-card p-6 flex flex-col gap-6 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Globe className="h-5 w-5 text-primary" />
            Buscar imagem na internet
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1.5 font-medium">
            {productName} {barcode && <span className="text-muted-foreground/60 font-normal">· cód. {barcode}</span>}
          </DialogDescription>
        </DialogHeader>

        {/* Barra de Pesquisa */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Digite o nome ou código de barras para pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background border-border/50 focus-visible:ring-primary/20"
            />
          </div>
          <Button type="submit" disabled={isLoading} className="gap-1.5">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Pesquisar
          </Button>
        </form>

        {/* Grade de Imagens */}
        <ScrollArea className="h-[320px] pr-3">
          {isLoading && images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">Buscando imagens na web...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground flex flex-col items-center gap-2">
              <AlertTriangle className="h-12 w-12 text-muted-foreground/30 stroke-[1.5]" />
              <p className="text-sm font-medium">Nenhuma imagem encontrada na internet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img, idx) => {
                const isSelected = selectedUrl === img.imageUrl;
                const isSubmitting = submittingUrl === img.imageUrl;

                return (
                  <div
                    key={`${img.imageUrl}-${idx}`}
                    title={img.title}
                    onClick={() => !isSubmitting && handleSelect(img)}
                    className={`relative aspect-square rounded-xl border-2 overflow-hidden bg-muted/30 cursor-pointer transition-all duration-300 group hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 shadow-md shadow-primary/5"
                        : "border-border/50 hover:border-primary/50"
                    }`}
                  >
                    <img loading="lazy" decoding="async"
                      src={img.thumbnailUrl}
                      alt={img.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        // Fallback em caso de erro na URL direta
                        e.currentTarget.src = img.imageUrl;
                      }}
                    />
                    
                    {/* Indicador de Seleção / Overlay */}
                    {isSubmitting && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-xs flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-[10px] text-white font-medium truncate">
                        {img.title || "Imagem na Web"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Rodapé e Paginação */}
        <div className="flex items-center justify-between border-t border-border/40 pt-4 text-xs text-muted-foreground">
          <span>Clique numa imagem para usá-la como foto do produto.</span>
          {images.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFetchMore}
              disabled={isLoading}
              className="h-8 border-border/50 font-medium"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : (
                <Globe className="h-3 w-3 mr-1.5" />
              )}
              Buscar mais 3
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}






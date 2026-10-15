import { useRef, useState } from "react";
import { Check, ImageIcon, Plus, ScanBarcode, Search, X } from "lucide-react";
import {
  CATALOG_UNAVAILABLE_REASON,
  buildPublicImageUrl,
  enumCode,
  type CatalogSearchItemDto,
} from "@workspace/api-client-react";
import {
  BarcodeScannerDialog,
  Button,
  canUseCamera,
  ImageHoverZoom,
  Input,
  Spinner,
  type ScanFeedback,
} from "@workspace/ui";
import { describeCardPrice, unavailableLabel } from "../lib/customSelection";

interface CatalogProductPickerProps {
  search: string;
  setSearch: (value: string) => void;
  /** Dispara a busca na hora — o Enter do campo. */
  onSubmit: () => void;
  /** Esvazia o campo e a lista — o "x" do campo. */
  onClear: () => void;
  /** Busca pelo código lido na câmera. */
  onScanCode: (code: string) => void;
  results: CatalogSearchItemDto[];
  isLoading: boolean;
  hasSearched: boolean;
  hasFailed: boolean;
  /** Quem já está na lista: o "+" vira um visto. */
  selectedIds: readonly number[];
  /** A lista chegou ao teto do formato. */
  isFull: boolean;
  /** Devolve se o produto entrou — só então o campo se esvazia. */
  onAdd: (result: CatalogSearchItemDto) => boolean;
}

/**
 * A busca da aba Personalizado, no molde da das Etiquetas: lista vazia até a
 * primeira busca, miniatura com zoom, câmera e "+" que esvazia o campo.
 *
 * A diferença é que aqui a lista mostra também quem NÃO pode entrar, apagado e
 * com o motivo ("sem saldo", "fora do site", "sem foto"): o produto que some da
 * busca deixa a pessoa procurando outro termo, quando o que falta é saldo.
 *
 * A câmera põe o código no campo e busca; a escolha fica no "+", porque a busca
 * por código também acha quem não pode entrar.
 */
export function CatalogProductPicker({
  search,
  setSearch,
  onSubmit,
  onClear,
  onScanCode,
  results,
  isLoading,
  hasSearched,
  hasFailed,
  selectedIds,
  isFull,
  onAdd,
}: CatalogProductPickerProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const cameraAvailable = canUseCamera();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = new Set(selectedIds);

  const handleScan = (code: string): ScanFeedback => {
    onScanCode(code);
    return { tone: "success", message: `Código ${code} lido. Escolha o produto na lista.`, close: true };
  };

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-foreground">Adicionar produtos</p>
        <p className="text-xs text-muted-foreground">
          Busque pelo nome ou pelo código de barras. A lista aparece a partir de 3 letras, ou no Enter.
        </p>
      </div>

      <div className="flex gap-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="relative flex-1"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar produtos..."
            aria-label="Buscar produtos para o banner"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="bg-background pl-9 pr-9"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Limpar busca"
              aria-label="Limpar busca"
              className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </form>
        {cameraAvailable && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            title="Buscar pelo código de barras, com a câmera"
            aria-label="Buscar pelo código de barras, com a câmera"
            onClick={() => setScannerOpen(true)}
          >
            <ScanBarcode className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : hasFailed ? (
        <p className="py-4 text-center text-sm text-destructive">
          Não foi possível buscar agora. Tente de novo em instantes.
        </p>
      ) : !hasSearched ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Digite o nome ou o código de barras do produto.
        </p>
      ) : results.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
      ) : (
        // A rolagem é da LISTA: com 20 resultados a tela inteira crescia e
        // empurrava para baixo a lista dos escolhidos.
        <ul className="flex max-h-[420px] flex-col divide-y divide-border/50 overflow-y-auto pr-1">
          {results.map((result) => {
            const reason = enumCode(result.unavailable, CATALOG_UNAVAILABLE_REASON);
            const blocked = reason !== CATALOG_UNAVAILABLE_REASON.None;
            const inList = selected.has(result.productGroupId);

            return (
              <li
                key={result.productGroupId}
                className={`flex items-center gap-3 py-2 ${blocked ? "opacity-60" : ""}`}
              >
                {result.imageUrl ? (
                  <ImageHoverZoom
                    src={buildPublicImageUrl(result.imageUrl)}
                    alt={result.name}
                    side="right"
                    className="h-10 w-10 shrink-0 cursor-zoom-in rounded-lg border border-border/50 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{result.name}</p>
                  {blocked ? (
                    <p className="text-xs text-destructive">
                      Não entra: {unavailableLabel(result.unavailable)}
                    </p>
                  ) : (
                    result.card && (
                      <p className="truncate text-xs text-muted-foreground">
                        {describeCardPrice(result.card)}
                      </p>
                    )
                  )}
                </div>

                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  disabled={blocked || inList || isFull}
                  title={
                    inList
                      ? "Já está no banner"
                      : blocked
                        ? `Não entra no banner: ${unavailableLabel(result.unavailable)}`
                        : isFull
                          ? "O banner está cheio"
                          : "Adicionar ao banner"
                  }
                  aria-label={
                    inList ? `${result.name} já está no banner` : `Adicionar ${result.name} ao banner`
                  }
                  onClick={() => {
                    if (onAdd(result)) onClear();
                    inputRef.current?.focus();
                  }}
                >
                  {inList ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        title="Buscar pelo código"
        description="Aponte para o código de barras do produto ou da etiqueta da prateleira."
        onDetected={handleScan}
      />
    </div>
  );
}

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import type { SpotlightBannerState } from "../hooks/useSpotlightBanner";
import { PieceOutput } from "./PieceOutput";
import { SpotlightControls } from "./SpotlightControls";

interface SpotlightDialogProps {
  state: SpotlightBannerState;
}

/**
 * A janela do banner de destaque, aberta pelo menu da listagem de produtos
 * (04/11/2026). Ela já abre gerando, no tipo escolhido no menu: são dois toques
 * até o arquivo.
 *
 * No celular a prévia vem ANTES dos campos, ao contrário da tela do catálogo. A
 * regra de lá (03/10/2026) existe porque a prévia ficava vazia acima do botão de
 * gerar; aqui ela nunca abre vazia, e o que a pessoa quer em seguida é
 * compartilhar. A rolagem é a nativa do conteúdo: `ScrollArea` em diálogo com
 * altura máxima corta em vez de rolar (armadilha 7 do repositório).
 */
export function SpotlightDialog({ state }: SpotlightDialogProps) {
  const name = state.info?.name ?? state.target?.name ?? "";

  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Banner de destaque</DialogTitle>
          <DialogDescription className="truncate">{name}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
            <div className="min-w-0 space-y-3 md:col-start-2 md:row-start-1">
              <PieceOutput
                status={state.status}
                format={state.format}
                piece={state.piece}
                progress={state.progress}
                busyNoun={state.busyNoun}
                errorMessage={state.errorMessage}
                canShare={state.canShare}
                isGenerating={state.isGenerating}
                onShare={state.share}
                onDownload={state.download}
                emptyHint="Escolha o tipo e o tamanho e toque em Gerar banner."
              />
            </div>

            <div className="min-w-0 md:col-start-1 md:row-start-1">
              <SpotlightControls
                kinds={state.kinds}
                kind={state.kind}
                onKindChange={state.setKind}
                formats={state.formats}
                format={state.format}
                onFormatChange={state.setFormat}
                title={state.title}
                titlePlaceholder={state.titlePlaceholder}
                onTitleChange={state.setTitle}
                printedName={state.printedName}
                namePlaceholder={name}
                onPrintedNameChange={state.setPrintedName}
                hints={state.hints}
                disabled={!state.target || state.isGenerating}
                hasPiece={state.piece !== null}
                onGenerate={() => void state.generate()}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

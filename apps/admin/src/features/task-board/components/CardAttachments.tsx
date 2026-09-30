import { useRef, useState } from "react";
import { ExternalLink, FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button, ConfirmDialog } from "@workspace/ui";
import { formatBrasiliaDateTime } from "@workspace/core";
import type { TaskCardAttachmentDto } from "@workspace/api-client-react";
import { formatFileSize } from "../board";

interface CardAttachmentsProps {
  attachments: TaskCardAttachmentDto[];
  onUpload: (file: File) => Promise<unknown>;
  isUploading: boolean;
  onDelete: (attachmentId: number) => Promise<unknown>;
  isDeleting: boolean;
}

/** Tipos que o backend aceita (o `accept` só filtra o seletor; a recusa de verdade é do servidor). */
const ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.mp4,.mov,.mp3,.ogg";

/**
 * Anexos do cartão: lista com miniatura para imagem, ícone para o resto, o
 * tamanho e quem enviou. Anexar abre o seletor de arquivo do aparelho — no
 * celular, isso inclui a câmera.
 */
export function CardAttachments({
  attachments,
  onUpload,
  isUploading,
  onDelete,
  isDeleting,
}: CardAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [toDelete, setToDelete] = useState<TaskCardAttachmentDto | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    // Um por vez, em sequência: a resposta de cada um invalida o cartão, e
    // disparar todos juntos faria a lista piscar a cada retorno.
    for (const file of Array.from(files)) await onUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Anexos</h3>
        {attachments.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{attachments.length}</span>
        )}
      </header>

      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 p-2"
            >
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted"
              >
                {attachment.contentType.startsWith("image/") ? (
                  <img src={attachment.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : attachment.contentType.startsWith("image") ? (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </a>
              <div className="min-w-0 flex-1">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 truncate text-sm font-medium hover:underline"
                >
                  <span className="truncate">{attachment.fileName}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)} · {formatBrasiliaDateTime(attachment.createdAt)}
                  {attachment.createdBy ? ` · ${attachment.createdBy}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setToDelete(attachment)}
                disabled={isDeleting}
                aria-label="Remover anexo"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="gap-1.5"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {isUploading ? "Enviando…" : "Anexar arquivo"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Imagens, PDF, Office, CSV, TXT, ZIP, vídeo e áudio, até 10 MB.
      </p>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Remover este anexo?"
        itemName={toDelete?.fileName}
        description="O anexo sai do cartão. O arquivo não pode ser recuperado pela tela depois disso."
        confirmLabel="Sim, remover"
        destructive
        loading={isDeleting}
        onConfirm={async () => {
          if (toDelete) await onDelete(toDelete.id);
          setToDelete(null);
        }}
      />
    </section>
  );
}

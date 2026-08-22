import { Info } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { formatBrasiliaDateTime, formatVersion } from "@workspace/core";

type AboutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Modal "Sobre o Sistema" do PDV.
 *
 * Exibe a versão atual do aplicativo e a data/hora da última atualização (deploy)
 * formatada no fuso horário de Brasília.
 */
export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const version = import.meta.env.VITE_APP_VERSION;
  const buildTime = import.meta.env.VITE_BUILD_TIME;

  const versionText = formatVersion(version);
  const updatedAtText = buildTime ? formatBrasiliaDateTime(buildTime) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-card border-border shadow-2xl">
        <div className="bg-primary/10 p-6 border-b border-border/50">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" /> Sobre o Sistema
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Informações da versão instalada e ambiente do PDV.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            <img
              src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
              alt="Uaus"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h3 className="text-sm font-bold text-foreground">Uaus! PDV</h3>
              <p className="text-xs text-muted-foreground">Ponto de Venda</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 p-4 space-y-3 bg-muted/10">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Versão:</span>
              <span className="font-semibold text-foreground font-mono" data-testid="about-version">
                {versionText}
              </span>
            </div>
            <div className="h-px bg-border/40" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Atualizado em:</span>
              <span className="font-medium text-foreground text-right" data-testid="about-updated-at">
                {updatedAtText || "—"}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)} className="w-full cursor-pointer">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

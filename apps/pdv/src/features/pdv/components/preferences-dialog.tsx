import { Moon, Printer, Settings, Sun } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Label } from "@workspace/ui";
import { usePdvStore } from "@/stores/use-pdv-store";

type PreferencesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Preferências do terminal: tema e impressão automática do cupom.
 *
 * São preferências **da máquina**, não do operador: ficam no `localStorage` (via
 * store) e valem para quem sentar no caixa depois. É o que se espera de um
 * terminal fixo — o brilho da tela do balcão não muda porque trocou o turno.
 *
 * Lê o store direto, em vez de receber tudo por prop, porque a tela do PDV não
 * usa nenhum desses campos: passá-los por prop faria a tela inteira renderizar
 * a cada troca de tema.
 */
export function PreferencesDialog({ open, onOpenChange }: PreferencesDialogProps) {
  const theme = usePdvStore((state) => state.theme);
  const setTheme = usePdvStore((state) => state.setTheme);
  const autoPrintReceipt = usePdvStore((state) => state.autoPrintReceipt);
  const setAutoPrintReceipt = usePdvStore((state) => state.setAutoPrintReceipt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-card border-border shadow-2xl">
        <div className="bg-primary/10 p-6 border-b border-border/50">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" /> Preferências
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Ajuste as configurações gerais do sistema.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Tema do Sistema
            </Label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                className={`flex-1 gap-2 h-14 font-semibold cursor-pointer ${
                  theme === "light"
                    ? "bg-primary text-primary-foreground border-none"
                    : "border-border/50 text-foreground"
                }`}
                onClick={() => setTheme("light")}
              >
                <Sun className="w-4 h-4" /> Claro
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                className={`flex-1 gap-2 h-14 font-semibold cursor-pointer ${
                  theme === "dark"
                    ? "bg-primary text-primary-foreground border-none"
                    : "border-border/50 text-foreground"
                }`}
                onClick={() => setTheme("dark")}
              >
                <Moon className="w-4 h-4" /> Escuro
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Cupom da Venda
            </Label>
            <button
              type="button"
              onClick={() => setAutoPrintReceipt(!autoPrintReceipt)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-muted/40 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold">Imprimir ao finalizar a venda</span>
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  autoPrintReceipt ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    autoPrintReceipt ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
            <p className="text-xs text-muted-foreground">
              Desligado, o cupom continua disponível pelo histórico de vendas.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)} className="w-full cursor-pointer">
              Salvar e Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

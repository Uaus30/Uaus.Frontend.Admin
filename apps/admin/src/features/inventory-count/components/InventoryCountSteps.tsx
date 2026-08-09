import { useRef } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@workspace/ui";

type InventoryCountStepsProps = {
  file: File | null;
  isExporting: boolean;
  isAnalyzing: boolean;
  onExport: () => void;
  onSelectFile: (file: File | null) => void;
};

/**
 * InventoryCountSteps
 *
 * Os dois passos da contagem: baixar a planilha e subir a planilha preenchida.
 *
 * Ficam lado a lado e numerados porque a rotina é semestral — quem a executa não
 * vai lembrar do fluxo, e a tela precisa ensiná-lo sem manual.
 */
export function InventoryCountSteps({
  file,
  isExporting,
  isAnalyzing,
  onExport,
  onSelectFile,
}: InventoryCountStepsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Step
        number={1}
        title="Baixar a planilha"
        description="Gera um arquivo com os produtos e o saldo atual. A coluna de contagem vem em branco para ser preenchida."
      >
        <Button variant="outline" onClick={onExport} disabled={isExporting} className="gap-2">
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar planilha
        </Button>
      </Step>

      <Step
        number={2}
        title="Importar a planilha preenchida"
        description="O sistema mostra o impacto antes de aplicar. Nada é alterado até você confirmar."
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(event) => {
            onSelectFile(event.target.files?.[0] ?? null);
            // Zera o input para que escolher o MESMO arquivo de novo dispare o
            // evento — sem isso, corrigir a planilha e reimportar não funciona.
            event.target.value = "";
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isAnalyzing}
            className="gap-2"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Escolher arquivo
          </Button>

          {file && (
            <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4 shrink-0" />
              <span className="truncate font-mono">{file.name}</span>
            </span>
          )}
        </div>
      </Step>
    </div>
  );
}

type StepProps = {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
};

function Step({ number, title, description, children }: StepProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary">
          {number}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>

      {children}
    </div>
  );
}



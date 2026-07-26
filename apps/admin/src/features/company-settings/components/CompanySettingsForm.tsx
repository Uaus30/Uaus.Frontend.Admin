import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

type CompanySettingsFormProps = {
  usesCashRegister: boolean;
  onUsesCashRegisterChange: (value: boolean) => void;
  /** Há alteração pendente de gravação. */
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
};

/**
 * CompanySettingsForm
 *
 * Opções de operação da loja. Cada opção explica a consequência prática de
 * desligá-la, porque o efeito acontece no PDV e não nesta tela.
 */
export function CompanySettingsForm({
  usesCashRegister,
  onUsesCashRegisterChange,
  isDirty,
  isLoading,
  isSaving,
  onSubmit,
}: CompanySettingsFormProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Operação de caixa</CardTitle>
          <CardDescription>Como o PDV se comporta no dia a dia da loja.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-6 rounded-xl border border-border/50 bg-background/50 p-4">
            <div className="space-y-1">
              <Label htmlFor="uses-cash-register" className="text-sm font-medium">
                Controlar caixa (abertura e fechamento por turno)
              </Label>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Desligado, o PDV não exige abertura de caixa para vender e as operações ficam sem
                sessão vinculada — vendas e baixas deixam de aparecer no fechamento de turno.
              </p>
            </div>
            <Switch
              id="uses-cash-register"
              checked={usesCashRegister}
              onCheckedChange={onUsesCashRegisterChange}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            {isDirty && (
              <span className="text-xs text-muted-foreground">Há alterações não salvas.</span>
            )}
            <Button type="submit" disabled={!isDirty || isSaving} className="hover-elevate">
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

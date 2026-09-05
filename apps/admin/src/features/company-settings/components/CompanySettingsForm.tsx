import { Loader2, Save } from "lucide-react";
import { Button } from "@workspace/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { Switch } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import type { SiteOptionsFields, StoreIdentityFields } from "../hooks/useCompanySettings";

type CompanySettingsFormProps = {
  usesCashRegister: boolean;
  onUsesCashRegisterChange: (value: boolean) => void;
  maxSellerDiscountPercentage: number;
  onMaxSellerDiscountPercentageChange: (value: number) => void;
  /** Identidade da loja impressa nos cupons. */
  identity: StoreIdentityFields;
  onIdentityChange: (field: keyof StoreIdentityFields, value: string) => void;
  /** Opções da vitrine pública (uaus.com.br). */
  site: SiteOptionsFields;
  onSiteChange: (field: keyof SiteOptionsFields, value: number) => void;
  /** Há alteração pendente de gravação. */
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
};

/** Campos de texto da identidade, na ordem em que saem impressos no cupom. */
const IDENTITY_INPUTS: Array<{
  field: keyof StoreIdentityFields;
  label: string;
  placeholder: string;
  hint?: string;
}> = [
  { field: "storeName", label: "Nome da loja", placeholder: "MÁXIMO 30" },
  { field: "addressLine", label: "Endereço", placeholder: "RUA PARANAGUÁ, 663" },
  {
    field: "cityState",
    label: "Cidade/UF",
    placeholder: "TAPIRA-PR",
    // A descrição do card diz que campo em branco usa o padrão de exemplo. Aqui
    // não usa: é o único campo sem valor embutido no cupom, e em branco a linha
    // some. O aviso fica no campo porque é onde a pessoa está olhando.
    hint: "Impresso logo abaixo do endereço, como digitado. Em branco, a linha não sai no cupom.",
  },
  {
    field: "phone",
    label: "Telefone",
    placeholder: "Cel: (44) 99137-2305",
    hint: "Impresso exatamente como digitado, rótulo incluso.",
  },
  {
    field: "document",
    label: "CNPJ",
    placeholder: "64.958.682/0001-22",
    hint: 'Só o número — o cupom imprime o rótulo "CNPJ:" sozinho.',
  },
];

/**
 * CompanySettingsForm
 *
 * Identidade impressa nos cupons e opções de operação da loja. Cada opção
 * explica a consequência prática, porque o efeito acontece no PDV e não nesta
 * tela.
 */
export function CompanySettingsForm({
  usesCashRegister,
  onUsesCashRegisterChange,
  maxSellerDiscountPercentage,
  onMaxSellerDiscountPercentageChange,
  identity,
  onIdentityChange,
  site,
  onSiteChange,
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
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Identidade da loja</CardTitle>
          <CardDescription>
            O que sai impresso no cabeçalho e no rodapé dos cupons. Campo em branco usa o valor padrão
            mostrado como exemplo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {IDENTITY_INPUTS.map(({ field, label, placeholder, hint }) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`identity-${field}`} className="text-sm font-medium">
                  {label}
                </Label>
                <Input
                  id={`identity-${field}`}
                  value={identity[field]}
                  onChange={(event) => onIdentityChange(field, event.target.value)}
                  placeholder={placeholder}
                  disabled={isSaving}
                />
                {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="identity-receiptFooterMessage" className="text-sm font-medium">
              Mensagem de rodapé
            </Label>
            <Textarea
              id="identity-receiptFooterMessage"
              value={identity.receiptFooterMessage}
              onChange={(event) => onIdentityChange("receiptFooterMessage", event.target.value)}
              placeholder="Obrigado pela preferência!"
              rows={2}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">Agradecimento impresso no fim de todo cupom.</p>
          </div>
        </CardContent>
      </Card>

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
                Desligado, o PDV não exige abertura de caixa para vender e as operações ficam sem sessão
                vinculada — vendas e baixas deixam de aparecer no fechamento de turno.
              </p>
            </div>
            <Switch
              id="uses-cash-register"
              checked={usesCashRegister}
              onCheckedChange={onUsesCashRegisterChange}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-start justify-between gap-6 rounded-xl border border-border/50 bg-background/50 p-4">
            <div className="space-y-1">
              <Label htmlFor="max-seller-discount" className="text-sm font-medium">
                Limite de desconto para vendedores (%)
              </Label>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Zero para sem limite. Descontos acima desse teto no balcão exigirão a senha de um
                Administrador.
              </p>
            </div>
            <Input
              id="max-seller-discount"
              type="number"
              min={0}
              max={100}
              value={maxSellerDiscountPercentage}
              onChange={(e) => onMaxSellerDiscountPercentageChange(Number(e.target.value))}
              disabled={isSaving}
              className="w-24 text-right"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Site (vitrine pública)</CardTitle>
          <CardDescription>
            O que o visitante de uaus.com.br vê. A quantidade em estoque nunca aparece no site — só a tag.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-6 rounded-xl border border-border/50 bg-background/50 p-4">
            <div className="space-y-1">
              <Label htmlFor="site-low-stock-threshold" className="text-sm font-medium">
                Tag &quot;Últimas unidades&quot; abaixo de (unidades)
              </Label>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Com o saldo do produto abaixo deste número o card ganha a tag &quot;Últimas unidades&quot;;
                com exatamente uma unidade, &quot;Último disponível&quot;. Zero desliga as duas tags. A
                reserva por WhatsApp não mexe no estoque — só a venda registrada no PDV.
              </p>
            </div>
            <Input
              id="site-low-stock-threshold"
              type="number"
              min={0}
              max={1000}
              step={1}
              value={site.lowStockThreshold}
              onChange={(e) => onSiteChange("lowStockThreshold", Number(e.target.value))}
              disabled={isSaving}
              className="w-24 text-right"
            />
          </div>

          <div className="flex items-start justify-between gap-6 rounded-xl border border-border/50 bg-background/50 p-4">
            <div className="space-y-1">
              <Label htmlFor="site-new-products-count" className="text-sm font-medium">
                Produtos na seção &quot;Novidades&quot; da página inicial
              </Label>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Os últimos produtos cadastrados aparecem na home do site, do mais novo para o mais antigo. De
                1 a 100.
              </p>
            </div>
            <Input
              id="site-new-products-count"
              type="number"
              min={1}
              max={100}
              step={1}
              value={site.newProductsCount}
              onChange={(e) => onSiteChange("newProductsCount", Number(e.target.value))}
              disabled={isSaving}
              className="w-24 text-right"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {isDirty && <span className="text-xs text-muted-foreground">Há alterações não salvas.</span>}
        <Button type="submit" disabled={!isDirty || isSaving} className="hover-elevate">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}

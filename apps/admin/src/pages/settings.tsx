import { Store } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { CompanySettingsForm } from "@/features/company-settings/components/CompanySettingsForm";
import { useCompanySettings } from "@/features/company-settings/hooks/useCompanySettings";

/**
 * Página de Configurações da Empresa.
 */
export default function CompanySettings() {
  const {
    usesCashRegister,
    setUsesCashRegister,
    maxSellerDiscountPercentage,
    setMaxSellerDiscountPercentage,
    identity,
    setIdentityField,
    isDirty,
    isLoading,
    isSaving,
    handleSubmit,
  } = useCompanySettings();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Identidade impressa nos cupons e opções de operação da loja. Elas valem para todos os terminais.
          </p>
        </div>

        <CompanySettingsForm
          usesCashRegister={usesCashRegister}
          onUsesCashRegisterChange={setUsesCashRegister}
          maxSellerDiscountPercentage={maxSellerDiscountPercentage}
          onMaxSellerDiscountPercentageChange={setMaxSellerDiscountPercentage}
          identity={identity}
          onIdentityChange={setIdentityField}
          isDirty={isDirty}
          isLoading={isLoading}
          isSaving={isSaving}
          onSubmit={handleSubmit}
        />
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  COMPANY_SETTINGS_QUERY_KEY,
  updateCompanySettings,
  useGetCompanySettings,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";

/**
 * Padrão local enquanto a leitura não chega.
 *
 * O backend também devolve controle de caixa ligado quando não há linha em
 * `company_settings` — o padrão é sempre o comportamento de sempre.
 */
const DEFAULT_USES_CASH_REGISTER = true;

/** Identidade da loja impressa nos cupons, como o formulário a edita. */
export interface StoreIdentityFields {
  /** Nome fantasia impresso em destaque no cabeçalho do cupom. */
  storeName: string;
  /** Endereço em linha única, como sai impresso. */
  addressLine: string;
  /** Telefone de contato, impresso exatamente como digitado. */
  phone: string;
  /** CNPJ cru, sem rótulo — o cupom imprime com o prefixo "CNPJ: ". */
  document: string;
  /** Mensagem de agradecimento do rodapé de todo cupom. */
  receiptFooterMessage: string;
}

const EMPTY_IDENTITY: StoreIdentityFields = {
  storeName: "",
  addressLine: "",
  phone: "",
  document: "",
  receiptFooterMessage: "",
};

/**
 * useCompanySettings
 *
 * Carrega e grava as opções de operação e a identidade da loja.
 */
export function useCompanySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetCompanySettings();
  const [usesCashRegister, setUsesCashRegister] = useState(DEFAULT_USES_CASH_REGISTER);
  const [maxSellerDiscountPercentage, setMaxSellerDiscountPercentage] = useState(0);
  const [identity, setIdentity] = useState<StoreIdentityFields>(EMPTY_IDENTITY);

  const serverValue = settings?.usesCashRegister;
  const serverMaxSellerDiscount = settings ? (settings.maxSellerDiscountPercentage ?? 0) : undefined;
  // Um backend anterior aos campos de identidade responde sem eles; o `?? ""`
  // deixa o formulário editável do mesmo jeito (a gravação simplesmente envia
  // campos que aquele backend ignora).
  const serverStoreName = settings ? (settings.storeName ?? "") : undefined;
  const serverAddressLine = settings ? (settings.addressLine ?? "") : undefined;
  const serverPhone = settings ? (settings.phone ?? "") : undefined;
  const serverDocument = settings ? (settings.document ?? "") : undefined;
  const serverFooterMessage = settings ? (settings.receiptFooterMessage ?? "") : undefined;

  // A sincronia depende dos valores, não do objeto devolvido pela query: um
  // refetch que traz exatamente o mesmo estado não pode apagar o que o usuário
  // acabou de mexer e ainda não salvou.
  useEffect(() => {
    if (serverValue == null) return;
    setUsesCashRegister(serverValue);
  }, [serverValue]);

  useEffect(() => {
    if (serverMaxSellerDiscount == null) return;
    setMaxSellerDiscountPercentage(serverMaxSellerDiscount);
  }, [serverMaxSellerDiscount]);

  useEffect(() => {
    if (serverStoreName == null) return;
    setIdentity({
      storeName: serverStoreName,
      addressLine: serverAddressLine ?? "",
      phone: serverPhone ?? "",
      document: serverDocument ?? "",
      receiptFooterMessage: serverFooterMessage ?? "",
    });
  }, [serverStoreName, serverAddressLine, serverPhone, serverDocument, serverFooterMessage]);

  /** Altera um campo da identidade sem tocar nos demais. */
  function setIdentityField(field: keyof StoreIdentityFields, value: string) {
    setIdentity((current) => ({ ...current, [field]: value }));
  }

  // Sujo por campo: qualquer um dos seis divergindo do servidor habilita salvar.
  const isIdentityDirty =
    serverStoreName != null &&
    (identity.storeName !== serverStoreName ||
      identity.addressLine !== serverAddressLine ||
      identity.phone !== serverPhone ||
      identity.document !== serverDocument ||
      identity.receiptFooterMessage !== serverFooterMessage);

  const isDirty =
    (serverValue != null && serverValue !== usesCashRegister) ||
    (serverMaxSellerDiscount != null && serverMaxSellerDiscount !== maxSellerDiscountPercentage) ||
    isIdentityDirty;

  const saveMutation = useMutation({
    // O PUT leva o objeto completo — configurações são uma linha única, não um
    // patch por campo. O `trim` evita gravar espaço acidental que o cupom
    // trataria como campo preenchido.
    mutationFn: () =>
      updateCompanySettings({
        usesCashRegister,
        maxSellerDiscountPercentage,
        storeName: identity.storeName.trim(),
        addressLine: identity.addressLine.trim(),
        phone: identity.phone.trim(),
        document: identity.document.trim(),
        receiptFooterMessage: identity.receiptFooterMessage.trim(),
      }),
    onSuccess: async () => {
      // O PDV e a reimpressão do painel leem a mesma chave; invalidar é o que
      // faz a mudança chegar lá sem recarregar a aplicação.
      await queryClient.invalidateQueries({ queryKey: COMPANY_SETTINGS_QUERY_KEY });
      toast({
        title: "Configurações salvas",
        description: "Os terminais passam a usar os novos valores nos próximos cupons.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao salvar as configurações",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /** Submete o formulário. Sem alteração pendente, não chama a API. */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isDirty) return;
    saveMutation.mutate();
  }

  return {
    usesCashRegister,
    setUsesCashRegister,
    maxSellerDiscountPercentage,
    setMaxSellerDiscountPercentage,
    identity,
    setIdentityField,
    isDirty,
    isLoading,
    isSaving: saveMutation.isPending,
    handleSubmit,
  };
}

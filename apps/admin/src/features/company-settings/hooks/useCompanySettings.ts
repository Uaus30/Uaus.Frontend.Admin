import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  COMPANY_SETTINGS_QUERY_KEY,
  updateCompanySettings,
  useGetCompanySettings,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/api-error";

/**
 * Padrão local enquanto a leitura não chega.
 *
 * O backend também devolve controle de caixa ligado quando não há linha em
 * `company_settings` — o padrão é sempre o comportamento de sempre.
 */
const DEFAULT_USES_CASH_REGISTER = true;

/**
 * useCompanySettings
 *
 * Carrega e grava as opções de operação da empresa.
 */
export function useCompanySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useGetCompanySettings();
  const [usesCashRegister, setUsesCashRegister] = useState(DEFAULT_USES_CASH_REGISTER);

  const serverValue = settings?.usesCashRegister;

  // A sincronia depende do valor, não do objeto devolvido pela query: um
  // refetch que traz exatamente o mesmo estado não pode apagar o toggle que o
  // usuário acabou de mexer e ainda não salvou.
  useEffect(() => {
    if (serverValue == null) return;
    setUsesCashRegister(serverValue);
  }, [serverValue]);

  const isDirty = serverValue != null && serverValue !== usesCashRegister;

  const saveMutation = useMutation({
    mutationFn: () => updateCompanySettings({ usesCashRegister }),
    onSuccess: async () => {
      // O PDV lê a mesma chave; invalidar é o que faz a mudança chegar lá sem
      // recarregar a aplicação.
      await queryClient.invalidateQueries({ queryKey: COMPANY_SETTINGS_QUERY_KEY });
      toast({
        title: "Configurações salvas",
        description: usesCashRegister
          ? "O PDV volta a exigir abertura de caixa para vender."
          : "O PDV passa a vender sem exigir abertura de caixa.",
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
    isDirty,
    isLoading,
    isSaving: saveMutation.isPending,
    handleSubmit,
  };
}

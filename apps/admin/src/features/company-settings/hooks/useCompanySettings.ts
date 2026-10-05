import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  COMPANY_SETTINGS_QUERY_KEY,
  updateCompanySettings,
  useGetCompanySettings,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  STANDARD_DEFAULT_MIN_STOCK,
  STANDARD_RESTOCK_SCORE_CUTOFF,
  STOCK_SETTINGS_ANCHOR,
} from "@/lib/stock-control";

/**
 * Padrão local enquanto a leitura não chega.
 *
 * O MESMO padrão do backend e do script de schema: sem linha em
 * `company_settings`, controle de caixa DESLIGADO. Divergir aqui fazia o
 * interruptor nascer ligado e virar desligado quando a leitura chegava — um
 * piscar que parecia a configuração mudando sozinha.
 */
const DEFAULT_USES_CASH_REGISTER = false;

/** DDD de fábrica do telefone de cliente (o de Tapira), o mesmo do backend. */
const STANDARD_AREA_CODE = 44;

/** Opções da vitrine (site público), como o formulário as edita. */
export interface SiteOptionsFields {
  /**
   * Abaixo de quantas unidades o site mostra "Últimas unidades"; uma unidade
   * vira "Último disponível". Zero desliga as duas tags.
   */
  lowStockThreshold: number;
  /** Quantos produtos a seção "Novidades" da home exibe. */
  newProductsCount: number;
}

/**
 * Padrões do site enquanto a leitura não chega — os MESMOS do backend e do
 * script de schema: tags de escassez desligadas e 20 novidades.
 */
const DEFAULT_SITE_OPTIONS: SiteOptionsFields = {
  lowStockThreshold: 0,
  newProductsCount: 20,
};

/** Identidade da loja impressa nos cupons, como o formulário a edita. */
export interface StoreIdentityFields {
  /** Nome fantasia impresso em destaque no cabeçalho do cupom. */
  storeName: string;
  /** Endereço em linha única, como sai impresso. */
  addressLine: string;
  /**
   * Cidade e UF, impressas na linha abaixo do endereço.
   *
   * Sai como for digitado — "TAPIRA-PR", "TAPIRA/PR", "Tapira - Paraná". O
   * separador é escolha de quem cadastra, não do código. Vazio não imprime linha.
   */
  cityState: string;
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
  cityState: "",
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
  const [identity, setIdentity] = useState<StoreIdentityFields>(EMPTY_IDENTITY);
  const [site, setSite] = useState<SiteOptionsFields>(DEFAULT_SITE_OPTIONS);
  const [defaultMinStock, setDefaultMinStockState] = useState(STANDARD_DEFAULT_MIN_STOCK);
  const [restockScoreCutoff, setRestockScoreCutoffState] = useState(STANDARD_RESTOCK_SCORE_CUTOFF);
  const [defaultAreaCode, setDefaultAreaCode] = useState(STANDARD_AREA_CODE);

  const serverValue = settings?.usesCashRegister;
  // Um backend anterior aos campos de identidade responde sem eles; o `?? ""`
  // deixa o formulário editável do mesmo jeito (a gravação simplesmente envia
  // campos que aquele backend ignora).
  const serverStoreName = settings ? (settings.storeName ?? "") : undefined;
  const serverAddressLine = settings ? (settings.addressLine ?? "") : undefined;
  const serverCityState = settings ? (settings.cityState ?? "") : undefined;
  const serverPhone = settings ? (settings.phone ?? "") : undefined;
  const serverDocument = settings ? (settings.document ?? "") : undefined;
  const serverFooterMessage = settings ? (settings.receiptFooterMessage ?? "") : undefined;
  // Um backend anterior às opções do site responde sem elas; o `??` deixa o
  // formulário editável com os padrões, e a gravação manda os dois campos.
  const serverLowStockThreshold = settings
    ? (settings.siteLowStockThreshold ?? DEFAULT_SITE_OPTIONS.lowStockThreshold)
    : undefined;
  const serverNewProductsCount = settings
    ? (settings.siteNewProductsCount ?? DEFAULT_SITE_OPTIONS.newProductsCount)
    : undefined;
  const serverDefaultMinStock = settings
    ? (settings.defaultMinStock ?? STANDARD_DEFAULT_MIN_STOCK)
    : undefined;
  const serverAreaCode = settings ? (settings.defaultAreaCode ?? STANDARD_AREA_CODE) : undefined;
  const serverRestockScoreCutoff = settings
    ? (settings.restockScoreCutoff ?? STANDARD_RESTOCK_SCORE_CUTOFF)
    : undefined;

  // A sincronia depende dos valores, não do objeto devolvido pela query: um
  // refetch que traz exatamente o mesmo estado não pode apagar o que o usuário
  // acabou de mexer e ainda não salvou.
  useEffect(() => {
    if (serverValue == null) return;
    setUsesCashRegister(serverValue);
  }, [serverValue]);

  useEffect(() => {
    if (serverStoreName == null) return;
    setIdentity({
      storeName: serverStoreName,
      addressLine: serverAddressLine ?? "",
      cityState: serverCityState ?? "",
      phone: serverPhone ?? "",
      document: serverDocument ?? "",
      receiptFooterMessage: serverFooterMessage ?? "",
    });
  }, [serverStoreName, serverAddressLine, serverCityState, serverPhone, serverDocument, serverFooterMessage]);

  // Sincronia feita DURANTE o render, e não num efeito: é o caso que a
  // documentação do React chama de "ajustar estado quando uma prop muda". Num
  // efeito a tela renderizaria uma vez com o valor velho — e o lint recusa
  // `setState` síncrono dentro de efeito. Depende dos VALORES, como os demais:
  // um refetch que traz o mesmo estado não apaga o que o usuário ainda não salvou.
  const [siteSyncedFrom, setSiteSyncedFrom] = useState<SiteOptionsFields | null>(null);
  if (
    serverLowStockThreshold != null &&
    serverNewProductsCount != null &&
    (siteSyncedFrom?.lowStockThreshold !== serverLowStockThreshold ||
      siteSyncedFrom?.newProductsCount !== serverNewProductsCount)
  ) {
    const fromServer = {
      lowStockThreshold: serverLowStockThreshold,
      newProductsCount: serverNewProductsCount,
    };
    setSiteSyncedFrom(fromServer);
    setSite(fromServer);
  }

  // Mesma sincronia durante o render, para o estoque mínimo padrão.
  const [minStockSyncedFrom, setMinStockSyncedFrom] = useState<number | null>(null);
  if (serverDefaultMinStock != null && minStockSyncedFrom !== serverDefaultMinStock) {
    setMinStockSyncedFrom(serverDefaultMinStock);
    setDefaultMinStockState(serverDefaultMinStock);
  }

  // E para a nota de corte da reposição (04/10/2026).
  const [cutoffSyncedFrom, setCutoffSyncedFrom] = useState<number | null>(null);
  if (serverRestockScoreCutoff != null && cutoffSyncedFrom !== serverRestockScoreCutoff) {
    setCutoffSyncedFrom(serverRestockScoreCutoff);
    setRestockScoreCutoffState(serverRestockScoreCutoff);
  }

  // E para o DDD padrão do telefone de cliente (01/10/2026).
  const [areaCodeSyncedFrom, setAreaCodeSyncedFrom] = useState<number | null>(null);
  if (serverAreaCode != null && areaCodeSyncedFrom !== serverAreaCode) {
    setAreaCodeSyncedFrom(serverAreaCode);
    setDefaultAreaCode(serverAreaCode);
  }

  // O campo "Estoque mínimo" do produto traz um link para `#estoque`. Numa SPA o
  // navegador não rola até a âncora sozinho — o cartão só existe depois da
  // leitura —, então a rolagem acontece aqui, quando ele aparece.
  useEffect(() => {
    if (isLoading || window.location.hash !== `#${STOCK_SETTINGS_ANCHOR}`) return;
    document.getElementById(STOCK_SETTINGS_ANCHOR)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [isLoading]);

  /** Altera o estoque mínimo padrão. Campo vazio ou lixo vira zero, e a validação segura no salvar. */
  function setDefaultMinStock(value: number) {
    setDefaultMinStockState(Number.isFinite(value) ? value : 0);
  }

  /** Altera a nota de corte da reposição. Campo vazio ou lixo vira zero, e a validação segura no salvar. */
  function setRestockScoreCutoff(value: number) {
    setRestockScoreCutoffState(Number.isFinite(value) ? value : 0);
  }

  /** Altera um campo da identidade sem tocar nos demais. */
  function setIdentityField(field: keyof StoreIdentityFields, value: string) {
    setIdentity((current) => ({ ...current, [field]: value }));
  }

  /** Altera uma opção do site. Campo vazio ou lixo vira zero, e a validação segura no salvar. */
  function setSiteField(field: keyof SiteOptionsFields, value: number) {
    setSite((current) => ({ ...current, [field]: Number.isFinite(value) ? value : 0 }));
  }

  // Sujo por campo: qualquer um dos seis divergindo do servidor habilita salvar.
  const isIdentityDirty =
    serverStoreName != null &&
    (identity.storeName !== serverStoreName ||
      identity.addressLine !== serverAddressLine ||
      identity.cityState !== serverCityState ||
      identity.phone !== serverPhone ||
      identity.document !== serverDocument ||
      identity.receiptFooterMessage !== serverFooterMessage);

  const isSiteDirty =
    serverLowStockThreshold != null &&
    serverNewProductsCount != null &&
    (site.lowStockThreshold !== serverLowStockThreshold || site.newProductsCount !== serverNewProductsCount);

  const isDirty =
    (serverDefaultMinStock != null && serverDefaultMinStock !== defaultMinStock) ||
    (serverRestockScoreCutoff != null && serverRestockScoreCutoff !== restockScoreCutoff) ||
    (serverAreaCode != null && serverAreaCode !== defaultAreaCode) ||
    (serverValue != null && serverValue !== usesCashRegister) ||
    isIdentityDirty ||
    isSiteDirty;

  const saveMutation = useMutation({
    // O PUT leva o objeto completo — configurações são uma linha única, não um
    // patch por campo. O `trim` evita gravar espaço acidental que o cupom
    // trataria como campo preenchido.
    mutationFn: () =>
      updateCompanySettings({
        usesCashRegister,
        storeName: identity.storeName.trim(),
        addressLine: identity.addressLine.trim(),
        cityState: identity.cityState.trim(),
        phone: identity.phone.trim(),
        document: identity.document.trim(),
        receiptFooterMessage: identity.receiptFooterMessage.trim(),
        siteLowStockThreshold: site.lowStockThreshold,
        siteNewProductsCount: site.newProductsCount,
        defaultMinStock,
        restockScoreCutoff,
        defaultAreaCode,
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
        error,
        variant: "destructive",
      });
    },
  });

  /**
   * Submete o formulário. Sem alteração pendente, não chama a API.
   *
   * A faixa das opções do site é conferida aqui, antes da ida à rede: o backend
   * também recusa, mas a mensagem dele chegaria como toast genérico de erro.
   */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isDirty) return;

    if (site.newProductsCount < 1 || site.newProductsCount > 100) {
      toast({
        title: "Quantidade de novidades inválida",
        description: "Informe entre 1 e 100 produtos para a seção Novidades do site.",
        variant: "destructive",
      });
      return;
    }
    if (site.lowStockThreshold < 0 || site.lowStockThreshold > 1000) {
      toast({
        title: "Limite de 'Últimas unidades' inválido",
        description: "Informe entre 0 (desligado) e 1000 unidades.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isInteger(defaultMinStock) || defaultMinStock < 0 || defaultMinStock > 1000) {
      toast({
        title: "Estoque mínimo padrão inválido",
        description: "Informe um número inteiro entre 0 (desligado) e 1000 unidades.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isInteger(restockScoreCutoff) || restockScoreCutoff < 0 || restockScoreCutoff > 100) {
      toast({
        title: "Nota de corte da reposição inválida",
        description: "Informe um número inteiro entre 0 (rotina desligada) e 100.",
        variant: "destructive",
      });
      return;
    }

    // Não existe DDD terminado em zero, e o telefone sem DDD ganharia um que
    // nenhum número tem.
    if (
      !Number.isInteger(defaultAreaCode) ||
      defaultAreaCode < 11 ||
      defaultAreaCode > 99 ||
      defaultAreaCode % 10 === 0
    ) {
      toast({
        title: "DDD padrão inválido",
        description: "Informe os dois dígitos do DDD da loja, de 11 a 99 (ex.: 44).",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate();
  }

  return {
    usesCashRegister,
    setUsesCashRegister,
    identity,
    setIdentityField,
    site,
    setSiteField,
    defaultMinStock,
    setDefaultMinStock,
    restockScoreCutoff,
    setRestockScoreCutoff,
    defaultAreaCode,
    setDefaultAreaCode,
    isDirty,
    isLoading,
    isSaving: saveMutation.isPending,
    handleSubmit,
  };
}

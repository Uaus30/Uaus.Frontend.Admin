import { useEffect, useMemo, useState } from "react";
import { useGetPaymentMethods, type PaymentMethodDto } from "@workspace/api-client-react";
import { listLocalPaymentMethods } from "@/offline";

/**
 * Formas de pagamento do checkout: as da API quando ela responde, as da base
 * local quando não.
 *
 * O formato é o mesmo nos dois caminhos, então nada no checkout precisa saber de
 * onde elas vieram — o que importa é o parcelamento com taxa, e ele vem nos
 * dois. A **ordem** também é a mesma: por ID, ou seja, ordem de cadastro.
 *
 * @param online A API está respondendo. Sem conexão a requisição só falharia.
 * @param hasLocalDatabase A base local existe; muda para recarregar a cópia
 *   local logo depois de um snapshot novo.
 */
export function usePdvPaymentMethods(online: boolean, hasLocalDatabase: boolean) {
  const { data: dbPaymentMethodsData } = useGetPaymentMethods(
    { isActive: true, size: 100 },
    { query: { enabled: online } },
  );

  const [localPaymentMethods, setLocalPaymentMethods] = useState<PaymentMethodDto[]>([]);

  // As formas locais são carregadas sempre, não só quando cai a conexão: a queda
  // pode acontecer com o checkout já aberto, e buscar na hora deixaria o operador
  // sem forma de pagamento na tela.
  useEffect(() => {
    let active = true;

    void listLocalPaymentMethods()
      .then((methods) => {
        if (!active) return;
        setLocalPaymentMethods(
          methods.map<PaymentMethodDto>((method) => ({
            id: method.id,
            // O snapshot só traz o que o checkout usa; as datas de auditoria não
            // fazem parte dele e nada na tela as consulta.
            createdAt: "",
            updatedAt: null,
            name: method.name,
            isActive: true,
            installments: method.installments.map((installment) => ({
              id: installment.id,
              paymentMethodId: method.id,
              installmentNumber: installment.installmentNumber,
              feePercentage: installment.feePercentage,
              isActive: true,
            })),
          })),
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [hasLocalDatabase]);

  const paymentMethods: PaymentMethodDto[] = useMemo(() => {
    const fromApi = (dbPaymentMethodsData?.data ?? []).filter((pm) => pm.isActive);
    // Lista vazia da API cai para a local: uma resposta sem formas ativas
    // travaria o checkout, e a cópia local tem pelo menos as do último snapshot.
    const emUso = fromApi.length > 0 ? fromApi : localPaymentMethods;

    // Ordem por ID é a ordem de cadastro: as formas que a loja usa desde sempre
    // (dinheiro, cartão) ficam no topo e as criadas depois vão para o fim. Sem
    // ordenar, o checkout herdava a ordem de quem respondeu — a paginação da API
    // num caminho, a chave do IndexedDB no outro — e a mesma tela trocava as
    // formas de lugar ao cair a conexão. O operador clica por posição.
    return [...emUso].sort((a, b) => a.id - b.id);
  }, [dbPaymentMethodsData, localPaymentMethods]);

  /**
   * Nome de cada forma por ID.
   *
   * O cupom de uma venda antiga precisa nomear formas que podem ter sido
   * desativadas depois — por isso o mapa é montado da lista em uso, e não
   * consultado forma a forma na hora de imprimir.
   */
  const paymentMethodNameById = useMemo(
    () => Object.fromEntries(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods],
  );

  return { paymentMethods, paymentMethodNameById };
}

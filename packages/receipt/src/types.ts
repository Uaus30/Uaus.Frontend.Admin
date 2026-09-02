/** Dados de identificação da loja impressos no cabeçalho do cupom. */
export interface ReceiptStore {
  /** Nome fantasia, em destaque logo abaixo da logo. */
  name: string;
  /** Endereço quebrado em linhas já prontas para impressão. */
  addressLines: string[];
  /** Telefone de contato, impresso como está (rótulo incluso, se houver). */
  phone?: string;
  /** Documento do estabelecimento, impresso como está (rótulo incluso, se houver). */
  document?: string;
}

/**
 * Identidade da loja no formato do cadastro da empresa (`CompanySettings`).
 *
 * É o que os apps passam em `ReceiptData.store` depois de `resolveStoreInfo`:
 * os nomes dos campos espelham o contrato da API, e a conversão para o formato
 * de impressão (`ReceiptStore`) — endereço em linhas, rótulo "CNPJ: " — fica
 * por conta do próprio cupom.
 */
export interface StoreInfo {
  /** Nome fantasia impresso em destaque no cabeçalho. */
  storeName: string;
  /** Endereço em linha única, como cadastrado. */
  addressLine: string;
  /**
   * Cidade e UF impressas na linha abaixo do endereço (ex.: "TAPIRA-PR").
   *
   * Vazio é estado legítimo: a linha some do cupom. É o único campo daqui sem
   * fallback — os outros substituem valores que já viviam hardcoded neste
   * pacote, e este nunca existiu.
   */
  cityState: string;
  /** Telefone de contato, impresso exatamente como cadastrado. */
  phone: string;
  /** CNPJ cru, sem rótulo — o cupom imprime com o prefixo "CNPJ: ". */
  document: string;
  /** Mensagem de agradecimento impressa no rodapé de todo cupom. */
  receiptFooterMessage: string;
}

/** Uma linha de produto do cupom. */
export interface ReceiptItem {
  /** Descrição impressa do produto. */
  name: string;
  quantity: number;
  /** Preço unitário efetivamente praticado (já líquido de desconto de item). */
  unitPrice: number;
  /**
   * Desconto concedido POR UNIDADE, em reais, já abatido de `unitPrice`: o
   * preço de tabela no momento da venda era `unitPrice + unitDiscount`.
   *
   * Maior que zero, o item sai com o preço de TABELA na linha da quantidade e
   * uma linha "Desconto" logo abaixo, com o abatimento da linha inteira
   * (unitário × quantidade). Sem este campo o cupom imprimia só o preço
   * líquido: o carregador de R$ 22,00 vendido a R$ 20,00 saía no papel como se
   * custasse R$ 20,00, e o desconto que o operador deu sumia do comprovante —
   * inclusive da segunda via, que é a que o cliente traz de volta ao balcão.
   *
   * Ausente ou zero, a linha sai como sempre saiu.
   */
  unitDiscount?: number;
  /** Unidade de medida exibida ao lado da quantidade. */
  unit?: string;
  /**
   * Código de barras, impresso acima da descrição. Omitido quando a origem não
   * o conhece — é o caso da reimpressão a partir da API, cujo item de venda não
   * carrega o código.
   */
  barcode?: string | null;
}

/**
 * Cupom de desconto aplicado na venda, como ele sai impresso.
 *
 * O bloco é opcional e existir já é a decisão: presente, o cupom ganha linha
 * própria entre o desconto e o TOTAL; ausente, nada muda no impresso.
 *
 * **As respostas do questionário da campanha NÃO entram aqui e nunca são
 * impressas.** O comprovante é o documento que o cliente leva no bolso e deixa
 * cair no balcão; sexo, faixa etária e "como conheceu a loja" são dado de
 * pesquisa, que vive no relatório da campanha e em nenhum papel.
 */
export interface ReceiptCoupon {
  /**
   * Código do cupom, como estava no panfleto — "10OFFSET26".
   *
   * Vem do SNAPSHOT do resgate, não do cadastro de hoje: o cupom pode ter sido
   * editado depois da venda, e a segunda via tem que sair igual à primeira.
   */
  code: string;
  /** Descrição do cupom, impressa numa linha menor logo abaixo. */
  description?: string | null;
  /**
   * Texto PRONTO do parâmetro do cupom — `"10%"` ou `"R$ 20,00"` —, montado por
   * quem chama e impresso entre parênteses ao lado do código.
   *
   * É texto e não `{ tipo, valor }` de propósito: o tipo é um enum do backend
   * (`CouponDiscountType`, que a API serializa ora pelo nome, ora pelo número) e
   * mora em `@workspace/api-client`, pacote do qual o cupom impresso **não
   * depende** — ele também é montado offline, a partir do snapshot local do PDV,
   * onde não há DTO nenhum por perto. Recebendo texto pronto, o layout nunca
   * precisa saber quantos tipos de desconto existem: um terceiro tipo amanhã
   * muda quem chama, não a impressão.
   *
   * Vazio é aceito e simplesmente omite os parênteses — é o que sobra de uma
   * venda antiga cujo snapshot não guardou tipo e valor.
   */
  label: string;
  /**
   * Reais efetivamente abatidos pelo cupom, impressos com o sinal "- ".
   *
   * É valor absoluto e positivo, como o desconto global: o sinal é decoração da
   * linha, não do número.
   */
  amount: number;
}

/** Uma forma de pagamento usada na venda. */
export interface ReceiptPayment {
  name: string;
  /** Valor pago nesta forma. Nulo quando a origem não informou a divisão. */
  amount: number | null;
  /** Número de parcelas; só é impresso quando maior que 1. */
  installments?: number;
}

/** Tudo que o cupom precisa para ser montado. */
export interface ReceiptData {
  /**
   * Número da venda, impresso como "Cupom".
   *
   * Aceita texto porque a venda registrada offline ainda não tem ID no banco: o
   * PDV imprime um número provisório ("OFF-14") que não colide com nenhum cupom
   * definitivo. Depois da sincronização, a reimpressão sai com o número real.
   */
  saleId: number | string;
  /** Data/hora da venda. */
  createdAt: string | Date;
  /** Operador do caixa. Omitido quando a origem não sabe quem vendeu. */
  operatorName?: string | null;
  /**
   * CPF/CNPJ do consumidor. É a única identificação impressa — ausente, o cupom
   * sai como "CONSUMIDOR: Não identificado".
   */
  customerDocument?: string | null;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
  /**
   * Desconto concedido pelo operador sobre o total da venda — **sem o cupom**,
   * que tem linha própria.
   *
   * Cuidado: o `discount` da API é o desconto TOTAL e **já inclui** a parcela do
   * cupom. Repassá-lo cru junto com o bloco `coupon` imprimiria o mesmo
   * abatimento duas vezes e a coluna deixaria de fechar — `Subtotal − Desconto −
   * Cupom` daria menos que o TOTAL impresso ao lado, na única conta que o
   * cliente confere de fato. Quem monta o cupom a partir da venda da API
   * (`buildReceiptFromSale`) já faz a subtração; quem monta do carrinho passa o
   * `globalDiscount` de `computeSaleTotals`, que sai discriminado do cupom.
   */
  discount?: number;
  /**
   * Cupom de desconto aplicado na venda. Ausente na venda sem cupom.
   *
   * Um por venda — não é cumulativo, e o índice único do resgate no banco é
   * quem garante isso.
   */
  coupon?: ReceiptCoupon;
  /** Total final da venda. Pode ser zero: o cupom zera a venda, nunca a torna negativa. */
  total: number;
  /** Valor em dinheiro recebido do cliente, quando houver. */
  amountReceived?: number | null;
  /** Troco devolvido. */
  change?: number | null;
  notes?: string | null;
  /** Marca o cupom como segunda via (reimpressão). */
  reprint?: boolean;
  /** Carimba o cupom como venda cancelada. */
  cancelled?: boolean;
  /**
   * Carimba o cupom como venda registrada sem conexão, com número provisório.
   * Avisa o operador de que aquele cupom ainda depende de sincronização.
   */
  offline?: boolean;
  /**
   * Sobrescreve os dados da loja para este cupom.
   *
   * Aceita a identidade completa vinda do cadastro (`StoreInfo`, resolvida por
   * `resolveStoreInfo`) ou a sobrescrita avulsa por campo do cabeçalho.
   */
  store?: Partial<ReceiptStore> | StoreInfo;
}

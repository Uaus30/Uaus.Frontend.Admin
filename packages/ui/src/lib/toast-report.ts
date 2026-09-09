/**
 * O texto que vai para a área de transferência quando alguém clica num toast.
 *
 * Existe para encurtar o relato de problema: sem isto, o que chega ao suporte é
 * uma foto da tela com a frase do toast — sem rota, sem horário, sem o status
 * HTTP e sem a resposta do servidor, que são justamente o que diz onde olhar.
 *
 * Mora em `packages/ui/src/lib/` e não em `packages/core` porque o pacote de UI
 * é folha do grafo (ver README): ele não importa de `@workspace/*`. A leitura do
 * erro aqui é por duck typing pelo mesmo motivo que a do `describeApiError` —
 * não depender da classe `ApiError`, que vive no `api-client`.
 */

/** Variantes do toaster, na ordem em que o usuário as encontra. */
export type ToastReportVariant = "default" | "destructive" | "warning";

/**
 * Rótulo textual da variante.
 *
 * Vai junto da cor de propósito: cor sozinha não identifica estado para quem
 * tem daltonismo, e o relatório copiado costuma acabar colado num lugar sem
 * cor nenhuma — card do ClickUp, e-mail, mensagem.
 */
const ROTULO_VARIANTE: Record<ToastReportVariant, string> = {
  default: "SUCESSO",
  destructive: "ERRO",
  warning: "AVISO",
};

/** Teto do corpo da resposta no relatório, em caracteres. */
const LIMITE_RESPOSTA = 1000;

/** Quantas linhas da pilha entram quando o erro não é HTTP. */
const LINHAS_DE_PILHA = 6;

export type ToastReportInput = {
  variant?: ToastReportVariant | null;
  /** Título como está na tela (o toaster o lê do DOM, então já vem string). */
  title?: string | null;
  /** Descrição como está na tela. */
  description?: string | null;
  /** Erro cru, quando quem disparou o toast tinha um em mãos. */
  error?: unknown;
  /** Host + caminho da tela onde o toast apareceu. */
  screen?: string | null;
  /** Versão do build, para separar "já corrigi" de "ele está no build antigo". */
  appVersion?: string | null;
  /** Injetável para o teste não depender do relógio. */
  occurredAt?: Date;
};

/**
 * Monta o relatório copiável de um toast.
 *
 * O bloco técnico só aparece quando há erro: num aviso de validação ("selecione
 * um fornecedor") não existe exceção nenhuma, e inventar linhas vazias faria o
 * relatório parecer truncado.
 *
 * @param input Dados do toast e, quando houver, o erro que o originou.
 * @returns Texto pronto para a área de transferência.
 */
export function buildToastReport(input: ToastReportInput): string {
  const rotulo = ROTULO_VARIANTE[input.variant ?? "default"] ?? ROTULO_VARIANTE.default;
  const quando = input.occurredAt ?? new Date();

  const cabecalho = [
    `[${rotulo}] ${input.title?.trim() || "(sem título)"}`,
    linha("Mensagem", input.description),
    linha("Quando", formatarMomento(quando)),
    linha("Tela", input.screen),
    linha("Versão", input.appVersion),
  ].filter(Boolean);

  const tecnico = descreverErro(input.error);

  return tecnico.length > 0 ? `${cabecalho.join("\n")}\n\n${tecnico.join("\n")}` : cabecalho.join("\n");
}

/**
 * Extrai do erro as linhas que ajudam a depurar.
 *
 * A ordem é a da investigação: qual requisição, que status devolveu, qual
 * exceção subiu e o que o servidor respondeu.
 */
function descreverErro(error: unknown): string[] {
  if (error == null) return [];

  if (typeof error === "string") {
    return error.trim() ? [linha("Exceção", error)] : [];
  }

  if (typeof error !== "object") return [linha("Exceção", String(error))];

  const bruto = error as Record<string, unknown>;
  const status = typeof bruto.status === "number" ? bruto.status : null;
  const metodo = typeof bruto.method === "string" ? bruto.method.toUpperCase() : "";
  const url = typeof bruto.url === "string" ? bruto.url : "";

  const linhas = [
    linha("Requisição", [metodo, url].filter(Boolean).join(" ")),
    linha("Status HTTP", status),
    linha("Exceção", descreverExcecao(error)),
    linha("Resposta", serializarResposta(bruto.payload)),
  ];

  // A pilha só entra quando não houve resposta HTTP. Em `ApiError` ela aponta
  // sempre para a mesma linha do cliente e não diz nada; num erro de runtime
  // (o `undefined is not a function` de uma tela) é a única pista que existe.
  if (status === null && typeof bruto.stack === "string") {
    const pilha = bruto.stack.split("\n").slice(0, LINHAS_DE_PILHA).join("\n").trim();
    if (pilha) linhas.push(`Pilha:\n${pilha}`);
  }

  return linhas.filter(Boolean);
}

/** `name: message` do erro, ignorando o `Error` genérico que não informa nada. */
function descreverExcecao(error: unknown): string {
  const bruto = error as { name?: unknown; message?: unknown };
  const nome = typeof bruto.name === "string" && bruto.name !== "Error" ? bruto.name : "";
  const mensagem = typeof bruto.message === "string" ? bruto.message.trim() : "";

  if (nome && mensagem) return `${nome}: ${mensagem}`;
  return nome || mensagem;
}

/**
 * Serializa o corpo devolvido pelo servidor, com teto de tamanho.
 *
 * Um `ValidationProblemDetails` grande ou um HTML de página de erro encheriam a
 * área de transferência com quilobytes que ninguém lê — e quem cola no card
 * perde a parte útil, que está no começo.
 */
function serializarResposta(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return truncar(payload.trim());

  try {
    return truncar(JSON.stringify(payload));
  } catch {
    // Referência circular: sobra dizer que veio algo, sem travar a cópia.
    return "(resposta não serializável)";
  }
}

function truncar(texto: string): string {
  return texto.length > LIMITE_RESPOSTA ? `${texto.slice(0, LIMITE_RESPOSTA)}… (truncado)` : texto;
}

/** Linha `Rótulo: valor`, ou string vazia — que o `filter(Boolean)` descarta. */
function linha(rotulo: string, valor: unknown): string {
  if (valor == null) return "";
  const texto = String(valor).trim();
  return texto ? `${rotulo}: ${texto}` : "";
}

/**
 * Data e hora locais, no formato que o usuário lê no relógio dele.
 *
 * Nada de `toISOString()`: quem recebe o relato compara com o horário do
 * WhatsApp da loja, e UTC jogaria o registro três horas para frente.
 */
function formatarMomento(data: Date): string {
  return data.toLocaleString("pt-BR");
}

/**
 * Descreve a tela atual para o relatório: host + caminho + busca.
 *
 * O host entra porque separa produção de dev e admin de PDV — é a primeira
 * pergunta de quem recebe o relato.
 */
export function describeCurrentScreen(): string {
  if (typeof window === "undefined") return "";
  const { host, pathname, search } = window.location;
  return `${host}${pathname}${search}`;
}

/**
 * Copia texto, com plano B para contexto não seguro.
 *
 * `navigator.clipboard` **não existe** fora de HTTPS/localhost. Um terminal de
 * PDV alcançado pelo IP da rede da loja cai exatamente nesse caso, e é onde a
 * cópia mais serve — por isso o `execCommand`, que é obsoleto mas funciona.
 *
 * @returns `true` se o texto chegou à área de transferência.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permissão negada ou aba sem foco: ainda vale tentar o plano B.
    }
  }

  return copiarPorCampoOculto(text);
}

function copiarPorCampoOculto(text: string): boolean {
  if (typeof document === "undefined" || !document.body) return false;

  const campo = document.createElement("textarea");
  campo.value = text;
  // Fora da tela e sem foco visível: o campo não pode piscar por cima do toast.
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.top = "-9999px";
  campo.style.opacity = "0";

  document.body.appendChild(campo);
  try {
    campo.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(campo);
  }
}

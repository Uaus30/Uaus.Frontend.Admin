/**
 * Identidade do cliente: telefone, CPF, faixa de idade e busca (01/10/2026).
 *
 * São as MESMAS regras do backend (`Validators/PhoneNumber.cs`, `Validators/Cpf.cs`,
 * `CustomerAgeRanges` e a busca do `CustomerService`). Elas precisam bater porque
 * o PDV cadastra e busca sem internet: um telefone que o caixa aceita e o
 * servidor recusa faria o cliente da venda sumir na sincronização.
 */

/** Só os dígitos do texto. */
function digitsOf(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * O telefone como o cadastro guarda: DDD + número, só dígitos.
 *
 * Ordem do backend: só dígitos; tira o 55 do país quando o número tem 12 ou 13
 * dígitos (com 11, "55" é o DDD de Santa Maria); tira o zero de discagem;
 * prefixa o DDD padrão da loja em número de 8 ou 9 dígitos.
 *
 * @param value Texto como o operador digitou ("99876-4321", "(44) 99876-4321").
 * @param defaultAreaCode DDD que vale quando o número vem sem ele.
 * @returns `{ ok: true, phone: null }` com o campo vazio; `ok: false` quando
 *   sobra um número que não é telefone.
 */
export function normalizePhone(
  value: string | null | undefined,
  defaultAreaCode: number,
): { ok: boolean; phone: string | null } {
  let digits = digitsOf(value);
  if (!digits) return { ok: true, phone: null };

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length === 8 || digits.length === 9)
    digits = `${String(defaultAreaCode).padStart(2, "0")}${digits}`;

  return isValidPhone(digits) ? { ok: true, phone: digits } : { ok: false, phone: null };
}

/**
 * Telefone já normalizado: 10 ou 11 dígitos, DDD sem zero (não existe DDD 20)
 * e o celular de 11 dígitos começando com 9.
 */
export function isValidPhone(digits: string | null | undefined): boolean {
  if (!digits || !/^\d{10,11}$/.test(digits)) return false;
  if (digits[0] === "0" || digits[1] === "0") return false;
  return digits.length === 10 || digits[2] === "9";
}

/** O CPF só com dígitos; `null` quando não sobra nenhum. */
export function normalizeCpf(value: string | null | undefined): string | null {
  const digits = digitsOf(value);
  return digits || null;
}

/**
 * Confere os dois dígitos verificadores. Recusa os onze iguais
 * ("111.111.111-11"), que passam na conta mas não existem.
 */
export function isValidCpf(digits: string | null | undefined): boolean {
  if (!digits || !/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return Number(digits[9]) === checkDigit(9) && Number(digits[10]) === checkDigit(10);
}

/**
 * Máscara progressiva de CPF ("529.982.247-25"), aplicada enquanto o operador
 * digita. Progressiva pelo mesmo motivo do telefone: completar a pontuação antes
 * da hora faria o cursor pular.
 */
export function formatCpf(value: string | null | undefined): string {
  const digits = digitsOf(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Faixas de idade do cadastro (enum `CustomerAgeRange` do backend). O zero é
 * "não informada", resposta válida: o operador nem sempre pergunta.
 */
export const AGE_RANGE = {
  NotInformed: 0,
  UpTo17: 1,
  From18To24: 2,
  From25To34: 3,
  From35To44: 4,
  From45To59: 5,
  From60: 6,
} as const;

/**
 * A faixa de quem nasceu em `birthDate`, no dia `today`. O aniversário que
 * ainda não chegou no ano conta: quem faz 18 amanhã ainda está em "Até 17".
 *
 * @param birthDate `yyyy-MM-dd`.
 * @returns O código da faixa, ou `null` com data inválida.
 */
export function ageRangeFromBirthDate(birthDate: string, today: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age--;

  if (age < 18) return AGE_RANGE.UpTo17;
  if (age < 25) return AGE_RANGE.From18To24;
  if (age < 35) return AGE_RANGE.From25To34;
  if (age < 45) return AGE_RANGE.From35To44;
  if (age < 60) return AGE_RANGE.From45To59;
  return AGE_RANGE.From60;
}

/** Máscara progressiva de data "dd/mm/aaaa", para o nascimento digitado. */
export function formatDateBr(value: string): string {
  const digits = digitsOf(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * "dd/mm/aaaa" → "yyyy-MM-dd", conferindo que a data existe, não é futura e é
 * depois de 1900 (as mesmas recusas do backend).
 *
 * @returns A data no formato da API, ou `null` quando incompleta ou inválida.
 */
export function parseDateBr(value: string, today: Date = new Date()): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (year < 1900 || date > today) return null;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** "yyyy-MM-dd" → "dd/mm/aaaa"; vazio quando não há data. */
export function isoDateToBr(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/**
 * A cidade da loja a partir do "Cidade e UF" das Configurações ("TAPIRA - PR",
 * "TAPIRA/PR", "Tapira - Paraná"): o texto antes do separador, com as iniciais
 * maiúsculas. É o valor que o cadastro rápido já traz preenchido.
 */
export function cityFromCityState(cityState: string | null | undefined): string {
  const city = (cityState ?? "").split(/\s*[-/,]\s*/)[0]?.trim() ?? "";
  return city
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|\s)(\p{L})/gu,
      (_, space: string, letter: string) => space + letter.toLocaleUpperCase("pt-BR"),
    );
}

/** Menos que isto, o número acharia meia loja: a busca cai no nome. */
export const CUSTOMER_SEARCH_MIN_DIGITS = 4;

/**
 * O termo da busca de cliente, lido uma vez (a mesma leitura do servidor).
 *
 * - `isNumeric`: só número (máscara, espaço e traço não contam) e pelo menos 4
 *   dígitos. Aí a busca é no telefone e no CPF.
 * - `digits`: os dígitos para o CPF, que pode começar com zero.
 * - `phoneDigits`: os dígitos lidos como telefone, sem o 55 do país e sem o
 *   zero de discagem.
 */
export function parseCustomerSearch(term: string): {
  text: string;
  digits: string;
  phoneDigits: string;
  isNumeric: boolean;
} {
  const text = term.trim();
  const digits = digitsOf(text);
  let phoneDigits =
    (digits.length === 12 || digits.length === 13) && digits.startsWith("55") ? digits.slice(2) : digits;
  phoneDigits = phoneDigits.replace(/^0+/, "");
  const isNumeric = digits.length >= CUSTOMER_SEARCH_MIN_DIGITS && !/\p{L}/u.test(text);
  return { text, digits, phoneDigits, isNumeric };
}

/**
 * O cliente do cadastro rápido que o servidor recusou por já existir (409): o
 * corpo do erro traz quem já tem aquele telefone ou CPF, para o caixa oferecer
 * "usar este cliente".
 *
 * Lê por duck typing, como `describeApiError`, e aceita as duas grafias: o
 * corpo de erro do backend sai em PascalCase (`Conflict.Id`).
 */
export function readDuplicateCustomer(
  error: unknown,
): { id: number; name: string; phone: string | null; document: string | null } | null {
  if (!error || typeof error !== "object" || !("payload" in error)) return null;
  const payload = (error as { payload: unknown }).payload;
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const conflict = (record.Conflict ?? record.conflict) as Record<string, unknown> | undefined;
  if (!conflict || typeof conflict !== "object") return null;

  const id = Number(conflict.Id ?? conflict.id);
  const name = conflict.Name ?? conflict.name;
  if (!Number.isFinite(id) || id <= 0 || typeof name !== "string") return null;

  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  return {
    id,
    name,
    phone: text(conflict.Phone ?? conflict.phone),
    document: text(conflict.Document ?? conflict.document),
  };
}

/** Os campos do cadastro que podem ser recusados, com a frase para o operador. */
export type CustomerIdentityErrors = Partial<Record<"name" | "phone" | "document" | "birthDate", string>>;

/**
 * Confere o cadastro antes de mandar: o nome, o telefone ou o CPF (pelo menos
 * um), e a data de nascimento digitada. As mesmas recusas do servidor, para o
 * erro aparecer no campo e não num toast — e para o caixa sem internet não
 * guardar um cadastro que o servidor recusaria na sincronização.
 *
 * @returns Os erros por campo (vazio quando está tudo certo) e os valores já
 *   normalizados: telefone com DDD, CPF e nascimento (`yyyy-MM-dd`).
 */
export function checkCustomerIdentity(
  input: { name: string; phone: string; document: string; birthDate: string },
  defaultAreaCode: number,
  today: Date = new Date(),
): {
  errors: CustomerIdentityErrors;
  phone: string | null;
  document: string | null;
  birthDate: string | null;
} {
  const errors: CustomerIdentityErrors = {};

  if (!input.name.trim()) errors.name = "Informe o nome: apelido ou primeiro nome serve.";

  const phone = normalizePhone(input.phone, defaultAreaCode);
  if (!phone.ok) errors.phone = "Telefone inválido: confira o DDD e o número.";

  const document = normalizeCpf(input.document);
  if (document && !isValidCpf(document)) errors.document = "CPF inválido: confira os números.";

  if (phone.ok && !phone.phone && !document)
    errors.phone = "Informe o telefone ou o CPF: é por eles que o caixa acha o cliente.";

  let birthDate: string | null = null;
  if (input.birthDate.trim()) {
    birthDate = parseDateBr(input.birthDate, today);
    if (!birthDate) errors.birthDate = "Data inválida: use dd/mm/aaaa.";
  }

  return { errors, phone: phone.phone, document, birthDate };
}

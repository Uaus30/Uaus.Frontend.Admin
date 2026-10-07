/**
 * O link que abre o WhatsApp com o comprovante escrito (07/10/2026).
 *
 * `wa.me` e não `whatsapp://`: o endereço oficial abre o app instalado no
 * Android e no iPhone e, sem o app, abre o WhatsApp Web — o esquema próprio só
 * daria erro. Com o telefone do cliente, a conversa abre direto com ele; sem,
 * o WhatsApp pergunta para quem mandar.
 *
 * @param text O comprovante já em texto (`buildReceiptText`).
 * @param phone Telefone do cliente como está no cadastro (com ou sem máscara).
 */
export function whatsappReceiptUrl(text: string, phone?: string | null): string {
  const number = toWhatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}

/**
 * O número no formato do `wa.me`: só dígitos, com o 55 do Brasil.
 *
 * O cadastro guarda o telefone com DDD e sem o país (10 dígitos o fixo, 11 o
 * celular). Número que não tem esse formato não vira destino: mandar o
 * comprovante para um número errado é pior que deixar o operador escolher o
 * contato.
 *
 * @returns O número, ou `null` quando não dá para confiar nele.
 */
export function toWhatsappNumber(phone?: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

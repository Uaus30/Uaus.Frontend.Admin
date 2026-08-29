import { useState } from "react";
import { buildContactMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

export interface ContactFormFields {
  name: string;
  phone: string;
  message: string;
}

export type ContactFormErrors = Partial<Record<keyof ContactFormFields, string>>;

const EMPTY_FIELDS: ContactFormFields = { name: "", phone: "", message: "" };

/**
 * Valida os campos. Exportada para o teste cobrir as regras sem montar o form.
 *
 * Telefone é OPCIONAL de propósito: a conversa vai acontecer no WhatsApp do
 * próprio visitante — o número dele já chega junto. O campo existe para quem
 * prefere ser chamado em outro número.
 */
export function validateContactFields(fields: ContactFormFields): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (fields.name.trim().length < 2) {
    errors.name = "Conte pra gente o seu nome.";
  }

  if (fields.message.trim().length < 5) {
    errors.message = "Escreva a sua mensagem (pelo menos 5 caracteres).";
  }

  const phoneDigits = fields.phone.replace(/\D/g, "");
  if (fields.phone.trim() && (phoneDigits.length < 10 || phoneDigits.length > 13)) {
    errors.phone = "Confira o telefone — use o DDD, ex.: (44) 99999-9999.";
  }

  return errors;
}

export interface ContactFormState {
  fields: ContactFormFields;
  errors: ContactFormErrors;
  setField: (field: keyof ContactFormFields, value: string) => void;
  /** Valida e, se ok, abre o WhatsApp com a mensagem montada. */
  submit: () => void;
}

/**
 * Formulário de contato SEM backend: validar, montar a mensagem e abrir o
 * WhatsApp da loja com ela pré-preenchida. O envio é do visitante, no app
 * dele — o site não envia nada sozinho (foi a troca deliberada pelo formulário
 * do site antigo, que postava num Express com credencial de e-mail hardcoded).
 *
 * @param openUrl Injetável nos testes; por padrão abre nova aba.
 */
export function useContactForm(
  openUrl: (url: string) => void = (url) => window.open(url, "_blank", "noopener"),
): ContactFormState {
  const [fields, setFields] = useState<ContactFormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<ContactFormErrors>({});

  const setField = (field: keyof ContactFormFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    // O erro do campo some assim que a pessoa volta a digitar nele.
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const submit = () => {
    const validation = validateContactFields(fields);
    setErrors(validation);

    if (Object.values(validation).some(Boolean)) return;

    openUrl(
      buildWhatsAppUrl(
        buildContactMessage({
          name: fields.name,
          phone: fields.phone.trim() || undefined,
          message: fields.message,
        }),
      ),
    );
  };

  return { fields, errors, setField, submit };
}

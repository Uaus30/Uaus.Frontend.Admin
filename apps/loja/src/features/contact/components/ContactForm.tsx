import { MessageSquare, Send } from "lucide-react";
import { useContactForm } from "../hooks/useContactForm";

const inputClass =
  "w-full rounded-xl border border-border bg-white px-4 py-3 text-foreground transition-colors outline-none focus:border-primary-strong focus:ring-4 focus:ring-primary-strong/15";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm font-medium text-red-500">{message}</p>;
}

/** Cartão do formulário — visual do site original, envio via WhatsApp. */
export function ContactForm() {
  const form = useContactForm();

  return (
    <div className="rounded-3xl border border-border bg-surface p-8 md:p-10">
      <h2 className="flex items-center gap-3 text-2xl font-bold text-foreground">
        <MessageSquare className="h-6 w-6 text-primary" />
        Envie uma mensagem
      </h2>

      <form
        className="mt-8 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        <div>
          <label htmlFor="contact-name" className="mb-2 block text-sm font-bold text-foreground">
            Nome Completo
          </label>
          <input
            id="contact-name"
            className={inputClass}
            placeholder="Seu nome"
            autoComplete="name"
            value={form.fields.name}
            onChange={(event) => form.setField("name", event.target.value)}
          />
          <FieldError message={form.errors.name} />
        </div>

        <div>
          <label htmlFor="contact-phone" className="mb-2 block text-sm font-bold text-foreground">
            Telefone / WhatsApp <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="contact-phone"
            className={inputClass}
            placeholder="(44) 99999-9999"
            autoComplete="tel"
            inputMode="tel"
            value={form.fields.phone}
            onChange={(event) => form.setField("phone", event.target.value)}
          />
          <FieldError message={form.errors.phone} />
        </div>

        <div>
          <label htmlFor="contact-message" className="mb-2 block text-sm font-bold text-foreground">
            Mensagem
          </label>
          <textarea
            id="contact-message"
            rows={5}
            className={inputClass}
            placeholder="Escreva sua mensagem aqui..."
            value={form.fields.message}
            onChange={(event) => form.setField("message", event.target.value)}
          />
          <FieldError message={form.errors.message} />
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-strong py-4 font-semibold text-white transition-colors duration-200 hover:bg-primary focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Enviar pelo WhatsApp
          <Send className="h-5 w-5" />
        </button>

        <p className="text-center text-xs text-muted-foreground">
          A mensagem abre no seu WhatsApp — nada é enviado sem você confirmar.
        </p>
      </form>
    </div>
  );
}

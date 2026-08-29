import { usePageTitle } from "@/lib/page-title";
import { ContactForm } from "@/features/contact/components/ContactForm";
import { ContactInfo } from "@/features/contact/components/ContactInfo";

/** Página de contato — masthead do site original + duas colunas. */
export default function ContactPage() {
  usePageTitle("Uaus | Contato");

  return (
    <div className="min-h-screen pb-24">
      <section className="mb-16 bg-primary pb-16 pt-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-4xl font-black text-white md:text-6xl">
            Fale <span className="text-white/90">Conosco</span>
          </h1>
          <p className="mt-4 text-lg text-white/90">
            Dúvidas, sugestões ou elogios? Queremos ouvir você. Preencha o formulário ou entre em contato pelo
            nosso WhatsApp.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-24 lg:px-8">
        <ContactForm />
        <ContactInfo />
      </div>
    </div>
  );
}

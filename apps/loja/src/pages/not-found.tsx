import { Compass } from "lucide-react";
import { Link } from "wouter";
import { usePageTitle } from "@/lib/page-title";

/**
 * 404 em português, dentro do layout do site — o original era o boilerplate do
 * shadcn em inglês ("Did you forget to add the page to the router?").
 */
export default function NotFoundPage() {
  usePageTitle("Uaus | Página não encontrada");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-orange-50/30 px-6 text-center">
      <Compass className="h-14 w-14 text-orange-300" aria-hidden />
      <h1 className="text-3xl font-extrabold text-foreground md:text-4xl">Página não encontrada</h1>
      <p className="max-w-md text-muted-foreground">
        O endereço que você tentou abrir não existe — mas a loja continua cheia de coisas por no máximo R$
        30,00.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-gradient-to-r from-primary to-orange-400 px-8 py-3 font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      >
        Voltar ao início
      </Link>
    </div>
  );
}

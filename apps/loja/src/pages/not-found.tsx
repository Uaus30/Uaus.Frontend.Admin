import { Link } from "wouter";
import { NotFoundScreen } from "@workspace/ui";
import { usePageTitle } from "@/lib/page-title";

/**
 * 404 da loja, dentro do layout do site (cabeçalho e rodapé continuam na tela).
 *
 * A tela vem do `@workspace/ui`, a mesma do admin e do PDV. O que sobra aqui é
 * o que só a vitrine tem: título de aba — visitante chega por link de fora e a
 * aba é o que ele vê antes da página — e um convite a continuar navegando, em
 * vez do aviso seco que basta para quem já está trabalhando nos apps internos.
 */
export default function NotFoundPage() {
  usePageTitle("Uaus | Página não encontrada");

  return (
    <NotFoundScreen
      description="O endereço que você tentou abrir não existe — mas a loja continua cheia de coisas por no máximo R$ 30,00."
      action={
        <Link
          href="/"
          className="rounded-xl bg-gradient-to-r from-primary to-orange-400 px-8 py-3 font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
          Voltar ao início
        </Link>
      }
    />
  );
}

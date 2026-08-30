import { Link } from "wouter";
import { buttonVariants, NotFoundScreen } from "@workspace/ui";

/**
 * 404 do PDV.
 *
 * Antes a rota coringa era um `Redirect` para `/`: o endereço errado sumia da
 * barra e o caixa aparecia como se nada tivesse acontecido. Num app instalado
 * como PWA, onde o operador não digita URL, isso escondia justamente o caso que
 * interessa — atalho ou link salvo apontando para uma tela que não existe mais.
 *
 * A ação leva ao caixa, que é a única tela do app; sem sessão, o portão do
 * `App.tsx` desvia para o login a partir de lá.
 */
export default function NotFound() {
  return (
    <NotFoundScreen
      className="min-h-full flex-1 bg-background"
      description="O endereço que você abriu não existe no caixa."
      action={
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Voltar ao caixa
        </Link>
      }
    />
  );
}

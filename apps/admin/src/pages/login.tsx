import { LoginForm } from "@/features/login/components/LoginForm";
import { useLoginFeature } from "@/features/login/hooks/useLoginFeature";

/**
 * Página de Login do Painel Administrativo.
 * Totalmente desacoplada, limpa e alinhada com as diretrizes AI-First.
 */
export default function Login() {
  const {
    identifier,
    setIdentifier,
    password,
    setPassword,
    isPending,
    handleSubmit,
  } = useLoginFeature();

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground relative overflow-hidden">
      {/* Imagem de fundo e gradientes de overlay decorativos */}
      <div className="absolute inset-0 z-0">
        <img loading="lazy" decoding="async" 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Login background" 
          className="w-full h-full object-cover opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent md:w-1/2 w-full" />
      </div>

      {/* Caixa do Formulário de login */}
      <div className="w-full max-w-md m-auto px-6 md:px-12 relative z-10 md:ml-[10%]">
        <LoginForm
          identifier={identifier}
          onIdentifierChange={setIdentifier}
          password={password}
          onPasswordChange={setPassword}
          isPending={isPending}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}


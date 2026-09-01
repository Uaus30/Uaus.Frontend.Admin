import { useEffect } from "react";

/** Um degrau da trilha, como o buscador espera lê-lo. */
export interface BreadcrumbStep {
  name: string;
  /** Caminho no site, começando com "/". Vira URL absoluta aqui. */
  path: string;
}

/**
 * Dados estruturados da trilha (`BreadcrumbList` do schema.org).
 *
 * É o que faz o resultado do Google trocar a URL crua
 * ("uaus.com.br/produtos/42") pela trilha legível ("Casa › Cozinha › Panela").
 * O `item` precisa ser URL ABSOLUTA — caminho relativo o buscador ignora
 * calado, e o teste de rich results não acusa erro, só deixa de mostrar a
 * trilha.
 */
export function buildBreadcrumbJsonLd(steps: BreadcrumbStep[], origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: steps.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: `${origin}${step.path}`,
    })),
  };
}

/**
 * Injeta um `<script type="application/ld+json">` no `head` enquanto a página
 * viver.
 *
 * Mesmo padrão imperativo do `usePageTitle` (hoje em `@workspace/ui`): o site
 * tem quatro rotas e não
 * paga um head manager por isso. O conteúdo entra serializado na dependência
 * para o efeito não reescrever a tag a cada render — objeto novo a cada render
 * remontaria o script sem parar.
 *
 * @param id Identificador da tag; um por tipo de dado estruturado na página.
 * @param data Objeto do schema.org, ou `undefined` enquanto o dado carrega.
 */
export function useJsonLd(id: string, data: object | undefined): void {
  const payload = data ? JSON.stringify(data) : undefined;

  useEffect(() => {
    if (!payload) return;

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    script.textContent = payload;
    document.head.appendChild(script);

    return () => script.remove();
  }, [id, payload]);
}

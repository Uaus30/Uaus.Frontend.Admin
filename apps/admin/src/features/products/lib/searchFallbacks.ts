/**
 * Gera termos alternativos de pesquisa para aumentar a resiliência da busca
 * em casos de diminutivos, erros de grafia, prefixos de ERP ou códigos residuais.
 */
export function getSearchFallbacks(query: string): string[] {
  if (!query || !query.trim()) return [];
  const fallbacks: string[] = [];
  const seen = new Set<string>();

  const add = (term: string) => {
    const trimmed = term.replace(/\s+/g, " ").trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      fallbacks.push(trimmed);
    }
  };

  add(query);

  // 1. Sem códigos numéricos longos (códigos de barras, IDs)
  const withoutBarcode = query.replace(/\b\d{4,}\b/g, "").trim();
  if (withoutBarcode) {
    add(withoutBarcode);
  }

  // 2. Limpeza de prefixos de ERP (PF., DIST., etc.) e unidades de medida no final (UN, CX, etc.)
  const cleanPunctuation = withoutBarcode.replace(/[.\-/_,\\]/g, " ");
  const tokens = cleanPunctuation.split(/\s+/).filter(Boolean);
  const erpPrefixes = new Set([
    "pf",
    "dist",
    "forn",
    "fab",
    "alim",
    "beb",
    "limp",
    "prod",
    "ind",
    "imp",
    "exp",
  ]);
  const stockUnits = new Set(["un", "und", "pc", "cx", "fd", "pct", "gr", "kg", "lt", "ml", "cm", "mm"]);

  const cleanTokens = tokens.filter((t, i) => {
    if (i === 0 && erpPrefixes.has(t.toLowerCase())) return false;
    if (i === tokens.length - 1 && stockUnits.has(t.toLowerCase())) return false;
    return true;
  });

  if (cleanTokens.length > 0) {
    add(cleanTokens.join(" "));
  }

  // 3. Normalização de diminutivos e grafias frequentes
  const stemMap: Record<string, string> = {
    rodinho: "rodo",
    rodinhos: "rodo",
    prisilia: "presilha",
    prisilias: "presilhas",
  };

  const normalizedTokens = cleanTokens.map((t) => {
    const lower = t.toLowerCase();
    const replaced = stemMap[lower];
    if (replaced) {
      return t === t.toUpperCase() ? replaced.toUpperCase() : replaced;
    }
    return t;
  });
  add(normalizedTokens.join(" "));

  // 4. Termo simplificado com as primeiras 3 palavras principais
  if (cleanTokens.length > 3) {
    add(cleanTokens.slice(0, 3).join(" "));
  }

  return fallbacks;
}

import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { describeApiError } from "@workspace/core";
import {
  ApiError,
  apiGet,
  apiGetBlob,
  apiGetOrThrow,
  apiPost,
  apiRequest,
  buildUrl,
  clearAuthSession,
  extractCreatedId,
  fetchAllPages,
  FETCH_ALL_PAGES_MAX_ITEMS,
  getAuthSession,
  isTokenExpired,
  mapPagedResult,
  resetUnauthorizedRedirect,
  setAuthSession,
} from "./client";
import type { AuthSession } from "./models";

/** Resposta de sucesso com o corpo informado, ou 204 quando o corpo é `null`. */
function mockResponse(body: unknown, status = 200) {
  return {
    ok: true,
    status: body === null ? 204 : status,
    text: async () => (body === null ? "" : JSON.stringify(body)),
    headers: new Headers(),
  } as unknown as Response;
}

/** Resposta de erro do backend, com o corpo que ele devolveria. */
function mockErrorResponse(status: number, body: unknown = "") {
  return {
    ok: false,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    headers: new Headers(),
  } as unknown as Response;
}

/** Download binário com os cabeçalhos informados. */
function mockBlobResponse(headers?: Record<string, string>) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    blob: async () => new Blob(["planilha"]),
  } as unknown as Response;
}

/**
 * Navegador de mentira.
 *
 * Os testes deste pacote rodam em Node (`vitest.config.ts`), onde `window` não
 * existe — e sem ele o client sai pela porta de trás do SSR: não limpa a sessão
 * e não navega. Quem exercita o 401 precisa dublar o AMBIENTE; o comportamento
 * verificado continua sendo o do client, não o do dublê.
 */
function stubBrowser(options?: { pathname?: string }) {
  const storage = new Map<string, string>();
  const assign = vi.fn();

  vi.stubGlobal("window", {
    location: {
      pathname: options?.pathname ?? "/produtos",
      origin: "https://admin.uaus.com.br",
      assign,
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  });

  return { storage, assign };
}

/** Deixa uma sessão válida gravada, como depois de um login bem-sucedido. */
function signIn(tokenValue = "token-do-caixa") {
  setAuthSession({
    user: { id: 1, username: "caixa" },
    token: { type: "Bearer", value: tokenValue, expiration: "2099-01-01T00:00:00Z" },
  } as AuthSession);
}

/** Última requisição que o client mandou para o `fetch`. */
function lastRequest(fetchMock: Mock) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined];
  return { url, headers: new Headers(init?.headers), body: init?.body };
}

afterEach(() => {
  vi.unstubAllGlobals();
  // A trava do redirecionamento mora no módulo. Sem rearmar, o primeiro teste de
  // 401 deixaria todos os seguintes sem redirecionamento nenhum — e eles
  // passariam por engano.
  resetUnauthorizedRedirect();
});

describe("buildUrl", () => {
  it("monta a query string a partir dos parâmetros", () => {
    const url = buildUrl("/Produtos", { search: "café", page: 2 });

    expect(url).toContain("/Produtos");
    expect(url).toContain("page=2");
    expect(url).toContain(`search=${encodeURIComponent("café")}`);
  });

  it("descarta parâmetro nulo, indefinido e string vazia", () => {
    // Enviar `search=` filtraria por string vazia em vez de não filtrar.
    const url = buildUrl("/Produtos", { search: "", page: null, size: undefined, ativo: false });

    expect(url).not.toContain("search=");
    expect(url).not.toContain("page=");
    expect(url).not.toContain("size=");
    // `false` é valor legítimo e precisa passar.
    expect(url).toContain("ativo=false");
  });

  it("aceita path sem barra inicial", () => {
    expect(buildUrl("Produtos")).toBe(buildUrl("/Produtos"));
  });

  it("serializa array como lista separada por vírgula e mantém booleano true", () => {
    // Documenta o formato que chega ao backend: `ids=1,2,3`, NÃO a chave
    // repetida `ids=1&ids=2&ids=3` que o model binding do ASP.NET espera por
    // padrão. Endpoint que precise do formato repetido tem de montar a query por
    // fora — descobrir isso pelo filtro que "não filtra nada" custa caro.
    const url = buildUrl("/Produtos", { ids: [1, 2, 3], onlyActive: true });

    expect(url).toContain(`ids=${encodeURIComponent("1,2,3")}`);
    expect(url).toContain("onlyActive=true");
  });

  it("resolve o base relativo do deploy contra a origem do navegador", async () => {
    // É a configuração real de produção: o app é servido pelo mesmo host e
    // "/api" é reescrito pelo proxy (vercel.json). O client precisa transformar
    // esse base relativo em URL absoluta — `new URL()` recusa caminho solto, e
    // sem a resolução TODA requisição do admin em produção falharia.
    //
    // O base é lido uma vez, na carga do módulo: por isso o navegador de mentira
    // vem ANTES do import, e não a fábrica de módulo em cache que os outros
    // testes usam.
    stubBrowser();
    vi.resetModules();
    const { buildUrl: buildUrlNoNavegador } = await import("./client");

    expect(buildUrlNoNavegador("/Produtos", { page: 2 })).toBe(
      "https://admin.uaus.com.br/api/Produtos?page=2",
    );
  });

  it("trata o path como caminho mesmo quando ele já é uma URL absoluta", () => {
    // buildUrl NÃO aceita URL pronta: ela vira caminho colado no base. É
    // exatamente por isso que apiGetBlob desvia da função quando a URL já é
    // absoluta (proxy de imagem) — ver o teste correspondente abaixo.
    expect(buildUrl("https://cdn.uaus.com.br/img.png")).toContain(
      "/https://cdn.uaus.com.br/img.png",
    );
  });
});

describe("sessão gravada no navegador", () => {
  it("grava, lê e apaga a sessão na chave que o app inteiro usa", () => {
    // A chave é literal de propósito: renomeá-la não quebra compilação nenhuma,
    // só desloga todo mundo no primeiro deploy — inclusive o caixa com venda
    // aberta.
    const { storage } = stubBrowser();

    signIn("token-123");
    expect(storage.get("uaus-office-auth")).toContain("token-123");
    expect(getAuthSession()?.token.value).toBe("token-123");

    clearAuthSession();
    expect(storage.has("uaus-office-auth")).toBe(false);
    expect(getAuthSession()).toBeNull();
  });

  it("devolve null quando o armazenamento tem lixo em vez de JSON", () => {
    // localStorage corrompido (extensão do navegador, versão antiga do app,
    // edição manual) não pode derrubar a aplicação na inicialização: sessão
    // ilegível tem que valer o mesmo que sessão ausente, levando ao login.
    const { storage } = stubBrowser();
    storage.set("uaus-office-auth", "{isto não é json");

    expect(getAuthSession()).toBeNull();
  });

  it("considera expirado o token vencido e o token sem data de expiração", () => {
    // O default é "expirado". Tratar a ausência de data como token válido
    // deixaria o app tentando usar para sempre um token que o servidor recusa.
    expect(isTokenExpired(null)).toBe(true);
    expect(isTokenExpired({ token: { expiration: "" } } as AuthSession)).toBe(true);
    expect(isTokenExpired({ token: { expiration: "2020-01-01T00:00:00Z" } } as AuthSession)).toBe(
      true,
    );
    expect(isTokenExpired({ token: { expiration: "2099-01-01T00:00:00Z" } } as AuthSession)).toBe(
      false,
    );
  });
});

describe("cabeçalhos e corpo da requisição", () => {
  it("assina a requisição com o token da sessão", async () => {
    // Sem o header montado aqui, cada chamada precisaria montá-lo por conta
    // própria — foi assim que os três downloads do admin ficaram fora do
    // tratamento central de 401.
    stubBrowser();
    signIn("token-abc");
    const fetchMock = vi.fn(async () => mockResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiGet("/Sales");

    expect(lastRequest(fetchMock).headers.get("Authorization")).toBe("Bearer token-abc");
  });

  it("não manda Authorization quando a chamada é anônima", async () => {
    // O login roda com `auth: false`. Mandar um token velho junto faz o servidor
    // recusar a autenticação por causa da sessão antiga, não da senha digitada.
    stubBrowser();
    signIn("token-velho");
    const fetchMock = vi.fn(async () => mockResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/Users/authenticate", { login: "ana" }, { auth: false });

    expect(lastRequest(fetchMock).headers.get("Authorization")).toBeNull();
  });

  it("serializa o corpo como JSON e anuncia o Content-Type", async () => {
    const fetchMock = vi.fn(async () => mockResponse({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/Produtos", { name: "Café" });

    const { headers, body } = lastRequest(fetchMock);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(body).toBe(JSON.stringify({ name: "Café" }));
  });

  it("deixa FormData passar intacto, sem Content-Type", async () => {
    // O boundary do multipart é gerado pelo navegador na hora do envio. Fixar
    // `application/json` aqui faria o upload da planilha de contagem chegar
    // ilegível ao backend, com erro que não aponta para o client.
    const fetchMock = vi.fn(async () => mockResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("file", new Blob(["a"]), "contagem.xlsx");

    await apiRequest("POST", "/InventoryCounts/import", { body: form });

    const { headers, body } = lastRequest(fetchMock);
    expect(headers.get("Content-Type")).toBeNull();
    expect(body).toBe(form);
  });
});

describe("ApiError", () => {
  it("carrega status, corpo, método e endereço da requisição que falhou", async () => {
    // Sem o status a tela não distingue "não encontrado" de "servidor caiu"; sem
    // o payload, describeApiError não tem de onde tirar a frase do backend.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockErrorResponse(422, { message: "Estoque insuficiente." })),
    );

    const error = await apiPost("/StockWriteOffs", { items: [] }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.payload).toEqual({ message: "Estoque insuficiente." });
    expect(apiError.method).toBe("POST");
    expect(apiError.url).toBe("/StockWriteOffs");
    expect(apiError.message).toBe("Estoque insuficiente.");
  });

  it("prefere `detail` ao `title` genérico do ASP.NET", async () => {
    // O ProblemDetails traz os dois. Mostrar o title deixaria o usuário com
    // "One or more validation errors occurred." em vez do motivo real.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockErrorResponse(400, {
          title: "One or more validation errors occurred.",
          detail: "A data de fechamento é anterior à abertura do caixa.",
        }),
      ),
    );

    await expect(apiGet("/FinancialClosings")).rejects.toThrow(
      "A data de fechamento é anterior à abertura do caixa.",
    );
  });

  it("aceita corpo de erro em texto puro", async () => {
    // Nem todo erro do pipeline volta em JSON (proxy, 502 do gateway). Sem este
    // caminho o JSON.parse quebraria antes de virar ApiError.
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(502, "Bad Gateway")));

    const error = (await apiGet("/Sales").catch((e: unknown) => e)) as ApiError;

    expect(error.payload).toBe("Bad Gateway");
    expect(error.message).toBe("Bad Gateway");
  });

  it("cai numa mensagem com status e endereço quando o corpo não tem nada legível", async () => {
    // "Erro 500 ao acessar /Sales" é feio, mas é o que permite abrir um chamado.
    // Toast vazio não permite.
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(500, { traceId: "00-abc" })));

    await expect(apiGet("/Sales")).rejects.toThrow("Erro 500 ao acessar /Sales");
  });

  it("entrega ao describeApiError as frases de validação que o servidor mandou", async () => {
    // Integração de verdade entre os dois pacotes: describeApiError lê
    // `payload.errors` por duck typing, então o ApiError PRECISA guardar o corpo
    // cru. Se ele passasse a guardar só a mensagem, todo formulário do admin
    // trocaria "A baixa precisa de ao menos um item." pelo genérico do ASP.NET —
    // e nada quebraria na compilação.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockErrorResponse(400, {
          title: "One or more validation errors occurred.",
          errors: {
            Items: ["A baixa precisa de ao menos um item."],
            Reason: ["Motivo inválido."],
          },
        }),
      ),
    );

    const error = await apiPost("/StockWriteOffs", {}).catch((e: unknown) => e);

    expect((error as ApiError).message).toBe("One or more validation errors occurred.");
    expect(describeApiError(error)).toBe("A baixa precisa de ao menos um item. Motivo inválido.");
  });
});

describe("401 — sessão recusada pelo servidor", () => {
  it("limpa a sessão e leva ao login", async () => {
    // Sem isto o usuário fica numa tela morta: todas as queries falham e nada
    // explica por quê.
    const { assign } = stubBrowser();
    signIn();
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(401)));

    await expect(apiGet("/Sales")).rejects.toBeInstanceOf(ApiError);

    expect(getAuthSession()).toBeNull();
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign.mock.calls[0][0]).toMatch(/\/login$/);
  });

  it("apaga só a chave de autenticação, não o armazenamento inteiro", async () => {
    // O PDV guarda estado local ao lado da sessão. Um `clear()` aqui levaria
    // junto o que ainda não sincronizou — venda pendente vira venda perdida.
    const { storage } = stubBrowser();
    signIn();
    storage.set("pdv-preferencias", "{\"impressora\":\"balcao\"}");
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(401)));

    await expect(apiGet("/Sales")).rejects.toBeInstanceOf(ApiError);

    expect(storage.has("uaus-office-auth")).toBe(false);
    expect(storage.get("pdv-preferencias")).toBe("{\"impressora\":\"balcao\"}");
  });

  it("redireciona UMA vez quando várias queries respondem 401 juntas", async () => {
    // Uma tela do admin tem meia dúzia de queries em voo e todas respondem 401
    // quando o token vence. Sem a deduplicação são N navegações para o login,
    // cada uma abortando a anterior — a tela pisca e às vezes não sai do lugar.
    const { assign } = stubBrowser();
    signIn();
    const fetchMock = vi.fn(async () => mockErrorResponse(401));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.allSettled([
      apiGet("/Sales"),
      apiGet("/Products"),
      apiGet("/Customers"),
      apiGet("/Suppliers"),
    ]);

    // As quatro requisições precisam MESMO ter levado 401 — sem esta conferência
    // o teste passaria por engano se três nunca tivessem saído.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("volta a redirecionar depois de rearmado", async () => {
    // A trava é por carregamento de página: no navegador ela morre junto com o
    // módulo. Se fosse definitiva, o segundo vencimento de token na mesma aba
    // não levaria mais ninguém ao login.
    const { assign } = stubBrowser();
    signIn();
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(401)));

    await expect(apiGet("/Sales")).rejects.toBeInstanceOf(ApiError);
    resetUnauthorizedRedirect();
    await expect(apiGet("/Sales")).rejects.toBeInstanceOf(ApiError);

    expect(assign).toHaveBeenCalledTimes(2);
  });

  it("não navega quando o usuário já está na tela de login", async () => {
    // Uma query de fundo respondendo 401 dentro do próprio login viraria laço de
    // recarregamento — a tela recarregando sozinha enquanto a pessoa digita.
    const { assign } = stubBrowser({ pathname: "/login" });
    signIn();
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(401)));

    await expect(apiGet("/Sales")).rejects.toBeInstanceOf(ApiError);

    expect(assign).not.toHaveBeenCalled();
    // A sessão recusada some de qualquer forma: ela não serve mais para nada.
    expect(getAuthSession()).toBeNull();
  });

  it("ignora o 401 de credencial errada no login (auth: false)", async () => {
    // Aqui o 401 é "senha errada", não "sessão vencida". Redirecionar apagaria a
    // mensagem do formulário e recarregaria a tela por cima do que foi digitado.
    const { assign } = stubBrowser();
    signIn();
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(401, { message: "Senha inválida." })));

    await expect(
      apiPost("/Users/authenticate", { login: "ana" }, { auth: false }),
    ).rejects.toThrow("Senha inválida.");

    expect(assign).not.toHaveBeenCalled();
    expect(getAuthSession()).not.toBeNull();
  });

  it("ignora o 401 do /Users/authenticate mesmo com sessão ativa", async () => {
    // Segunda trava, pelo caminho: uma reautenticação (autorização gerencial)
    // com senha errada não pode derrubar a sessão do caixa que está no meio de
    // uma venda.
    const { assign } = stubBrowser();
    signIn();
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(401, { message: "Senha inválida." })));

    await expect(apiPost("/Users/authenticate", { login: "gerente" })).rejects.toThrow(
      "Senha inválida.",
    );

    expect(assign).not.toHaveBeenCalled();
    expect(getAuthSession()).not.toBeNull();
  });

  it("não derruba a sessão em erro que não é 401", async () => {
    // 403 é "logado, mas sem permissão". Tratar como sessão vencida deslogaria
    // quem só clicou onde não devia.
    const { assign } = stubBrowser();
    signIn();
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(403, { message: "Sem permissão." })));

    await expect(apiGet("/Users")).rejects.toThrow("Sem permissão.");

    expect(assign).not.toHaveBeenCalled();
    expect(getAuthSession()).not.toBeNull();
  });

  it("navega para a rota de login do app, não para uma URL do backend", async () => {
    // A URL do login sai do BASE_URL do bundle (raiz nos testes), NÃO do
    // API_BASE_URL. Mandar para o host da API abriria uma página que não existe
    // e ainda perderia a sessão do navegador.
    //
    // O caso da subpasta (BASE_URL "/pdv/") não é coberto de propósito: o client
    // lê esse valor por um cast que o rewriter do Vitest não enxerga, então ele
    // é imutável no teste. Está registrado nas pendências.
    const { assign } = stubBrowser();
    signIn();
    vi.stubGlobal("fetch", vi.fn(async () => mockErrorResponse(401)));

    await expect(apiGet("/Sales")).rejects.toBeInstanceOf(ApiError);

    expect(assign).toHaveBeenCalledWith("/login");
  });
});

describe("apiGetBlob", () => {
  it("usa o nome do Content-Disposition entre aspas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockBlobResponse({ "Content-Disposition": 'attachment; filename="contagem 2026.xlsx"' }),
      ),
    );

    const file = await apiGetBlob("/InventoryCounts/export", "padrao.xlsx");

    expect(file.fileName).toBe("contagem 2026.xlsx");
  });

  it("aceita o nome sem aspas", async () => {
    // Nem todo servidor cita o valor. Sem tolerar as duas formas, metade dos
    // downloads sairia com o nome de fallback.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockBlobResponse({ "Content-Disposition": "attachment; filename=contagem.xlsx" }),
      ),
    );

    await expect(apiGetBlob("/InventoryCounts/export", "padrao.xlsx")).resolves.toMatchObject({
      fileName: "contagem.xlsx",
    });
  });

  it("decodifica nome em UTF-8 percent-encoded", async () => {
    // Sem decodificar, o arquivo chega ao usuário como
    // "relat%C3%B3rio.xlsx" — nome que o Windows aceita e ninguém reconhece.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockBlobResponse({
          "Content-Disposition": "attachment; filename*=UTF-8''relat%C3%B3rio%20anual.xlsx",
        }),
      ),
    );

    await expect(apiGetBlob("/Reports/annual", "padrao.xlsx")).resolves.toMatchObject({
      fileName: "relatório anual.xlsx",
    });
  });

  it("no cabeçalho combinado vence o `filename*`, não o fallback ASCII", async () => {
    // É assim que o ASP.NET manda nome acentuado: o `filename` ASCII vem PRIMEIRO,
    // como reserva para cliente antigo, e o `filename*` traz o nome de verdade. A
    // RFC 6266 manda preferir o segundo. Uma regex única sobre o cabeçalho inteiro
    // casa com o que vem antes e perde o acento — justamente nos relatórios em
    // português, que são quase todos.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockBlobResponse({
          "Content-Disposition":
            "attachment; filename=relatrio.xlsx; filename*=UTF-8''relat%C3%B3rio.xlsx",
        }),
      ),
    );

    await expect(apiGetBlob("/Reports/annual", "padrao.xlsx")).resolves.toMatchObject({
      fileName: "relatório.xlsx",
    });
  });

  it("aceita nome com % literal em vez de derrubar o download inteiro", async () => {
    // REGRESSÃO: `decodeURIComponent("desconto 50%.pdf")` lança URIError. Sem o
    // try/catch o erro escapava do apiGetBlob e o usuário ficava sem o arquivo
    // por causa do NOME dele — não do conteúdo.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockBlobResponse({ "Content-Disposition": 'attachment; filename="desconto 50%.pdf"' }),
      ),
    );

    await expect(apiGetBlob("/Reports/promo", "padrao.pdf")).resolves.toMatchObject({
      fileName: "desconto 50%.pdf",
    });
  });

  it("cai no nome padrão quando o servidor não manda o cabeçalho", async () => {
    // O proxy de imagem não manda Content-Disposition. Sem o fallback o arquivo
    // seria salvo como "undefined".
    vi.stubGlobal("fetch", vi.fn(async () => mockBlobResponse()));

    await expect(apiGetBlob("/Images/9/raw", "imagem.jpg")).resolves.toMatchObject({
      fileName: "imagem.jpg",
    });
  });

  it("assina o download com o token da sessão", async () => {
    // O motivo de existir da função: os três pontos que montavam esse header na
    // mão ficavam fora do tratamento central de 401.
    stubBrowser();
    signIn("token-do-download");
    const fetchMock = vi.fn(async () => mockBlobResponse());
    vi.stubGlobal("fetch", fetchMock);

    await apiGetBlob("/InventoryCounts/export", "padrao.xlsx");

    expect(lastRequest(fetchMock).headers.get("Authorization")).toBe("Bearer token-do-download");
  });

  it("401 no download também limpa a sessão e leva ao login", async () => {
    // Era exatamente o buraco do fetch manual: o token vencia no meio de um
    // export e o usuário recebia um erro genérico numa tela já morta.
    const { assign } = stubBrowser();
    signIn();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 }) as unknown as Response));

    await expect(apiGetBlob("/InventoryCounts/export", "padrao.xlsx")).rejects.toBeInstanceOf(
      ApiError,
    );

    expect(getAuthSession()).toBeNull();
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("falha do download vira ApiError com o status", async () => {
    // O chamador precisa do status para separar "arquivo não existe" de "servidor
    // fora do ar". Um Error genérico obrigaria a ler a string da mensagem.
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response));

    const error = (await apiGetBlob("/Reports/annual", "padrao.xlsx").catch(
      (e: unknown) => e,
    )) as ApiError;

    expect(error.status).toBe(500);
    expect(error.message).toContain("/Reports/annual");
  });

  it("manda URL absoluta como está e monta a relativa com os parâmetros", async () => {
    // O proxy de imagem chega pronto; colá-lo no base do backend daria uma URL
    // inexistente. O caminho relativo, ao contrário, precisa do base e da query.
    const fetchMock = vi.fn(async () => mockBlobResponse());
    vi.stubGlobal("fetch", fetchMock);

    await apiGetBlob("https://cdn.uaus.com.br/img.png", "imagem.jpg");
    expect(lastRequest(fetchMock).url).toBe("https://cdn.uaus.com.br/img.png");

    await apiGetBlob("/InventoryCounts/export", "padrao.xlsx", { params: { countId: 7 } });
    const { url } = lastRequest(fetchMock);
    expect(url).toContain("/InventoryCounts/export");
    expect(url).toContain("countId=7");
  });
});

describe("apiGet", () => {
  it("devolve o corpo quando ele existe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse({ id: 1, nome: "Café" })));

    await expect(apiGet<{ id: number }>("/Produtos/1")).resolves.toEqual({ id: 1, nome: "Café" });
  });

  it("devolve null em HTTP 204", async () => {
    // REGRESSÃO: a assinatura antiga era `as T`, então o `null` que o client
    // produz chegava à tela tipado como objeto — e ela quebrava ao ler um campo.
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(null)));

    await expect(apiGet<{ id: number }>("/Cupons/por-codigo/INEXISTENTE")).resolves.toBeNull();
  });

  it("devolve null quando o corpo vem vazio com status 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "",
        headers: new Headers(),
      }) as unknown as Response),
    );

    await expect(apiGet("/Qualquer")).resolves.toBeNull();
  });
});

describe("apiGetOrThrow", () => {
  it("devolve o corpo quando ele existe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse({ items: [], pagination: {} })));

    await expect(apiGetOrThrow("/Produtos")).resolves.toEqual({ items: [], pagination: {} });
  });

  it("lança ApiError quando a resposta vem sem corpo", async () => {
    // Listagem paginada sem corpo é falha do servidor. Propagar null dali só
    // empurraria o problema para dentro da tela.
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(null)));

    await expect(apiGetOrThrow("/Produtos")).rejects.toBeInstanceOf(ApiError);
  });

  it("o erro identifica o endereço que falhou", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(null)));

    await expect(apiGetOrThrow("/Produtos")).rejects.toThrow(/\/Produtos/);
  });
});

describe("mapPagedResult", () => {
  it("traduz o formato do backend para o da UI", () => {
    // O backend manda `page`/`size`/`filteredItems`; a UI consome
    // `page`/`limit`/`total`. `totalPages` NÃO vem do servidor — é calculado
    // aqui, e é por isso que ele nunca diverge do total com o limite atual.
    const result = mapPagedResult({
      items: [{ id: 1 }, { id: 2 }],
      pagination: { page: 2, size: 10, filteredItems: 25 },
    });

    expect(result.data).toHaveLength(2);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.total).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  it("assume os padrões quando a paginação vem incompleta", () => {
    const result = mapPagedResult({ items: [{ id: 1 }], pagination: {} });

    expect(result.page).toBe(1);
    expect(result.limit).toBe(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("nunca devolve menos de uma página, mesmo sem itens", () => {
    // Zero páginas deixaria a paginação da tela num estado impossível.
    const result = mapPagedResult({ items: [], pagination: { page: 1, size: 20, filteredItems: 0 } });

    expect(result.totalPages).toBe(1);
  });
});

describe("extractCreatedId", () => {
  it("lê o id do cabeçalho Location", () => {
    const response = {
      headers: new Headers({ Location: "/api/Produtos/42" }),
    } as unknown as Response;

    expect(extractCreatedId(response)).toBe(42);
  });

  it("devolve null sem cabeçalho Location", () => {
    const response = { headers: new Headers() } as unknown as Response;

    expect(extractCreatedId(response)).toBeNull();
  });
});

describe("fetchAllPages", () => {
  /**
   * Servidor paginado de mentira: devolve a fatia pedida de `items` e o total
   * declarado, que pode ser MAIOR que a lista — é assim que se simula o catálogo
   * grande sem materializar 6.000 objetos no teste.
   */
  function stubPagedApi(items: unknown[], declaredTotal = items.length) {
    const calls: { page: number; size: number; concurrent: number }[] = [];
    let inFlight = 0;
    let peak = 0;

    const fetchMock = vi.fn(async (url: string) => {
      const query = new URL(url, "http://local").searchParams;
      const page = Number(query.get("page") ?? 1);
      const size = Number(query.get("size") ?? 200);

      inFlight++;
      peak = Math.max(peak, inFlight);
      calls.push({ page, size, concurrent: inFlight });

      // Cede o event loop para as requisições realmente se sobreporem: sem isso
      // cada uma resolveria antes da próxima começar e o pico seria sempre 1.
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight--;

      return mockResponse({
        items: items.slice((page - 1) * size, page * size),
        pagination: { page, size, filteredItems: declaredTotal },
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    return { calls, peak: () => peak };
  }

  it("junta as páginas na ordem das páginas, não na ordem de resposta", async () => {
    // O resultado alimenta combo de seleção; ordem instável faria a mesma lista
    // aparecer embaralhada a cada carregamento.
    const items = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));
    stubPagedApi(items);

    await expect(fetchAllPages<{ id: number }>("/Categorias", undefined, 10)).resolves.toEqual(
      items,
    );
  });

  it("não pede a segunda página quando a primeira já trouxe tudo", async () => {
    const { calls } = stubPagedApi([{ id: 1 }, { id: 2 }]);

    await fetchAllPages("/Departamentos", undefined, 10);

    expect(calls).toHaveLength(1);
  });

  it("repassa os filtros em TODAS as páginas", async () => {
    // Mandar o filtro só na primeira página traria o catálogo inteiro da segunda
    // em diante — e a tela mostraria itens que o filtro deveria ter escondido.
    const items = Array.from({ length: 30 }, (_, index) => ({ id: index }));
    const { calls } = stubPagedApi(items);
    const fetchMock = vi.mocked(globalThis.fetch);

    await fetchAllPages("/ProductTags", { productId: 7 }, 10);

    expect(calls).toHaveLength(3);
    for (const [url] of fetchMock.mock.calls as unknown as [string][]) {
      expect(url).toContain("productId=7");
    }
  });

  it("limita quantas páginas vão ao servidor ao mesmo tempo", async () => {
    // REGRESSÃO: a versão anterior montava um Promise.all com todas as páginas
    // restantes — 40 requisições no mesmo tick, das quais o navegador executava
    // 6 e as outras 34 ficavam pendentes segurando memória.
    const items = Array.from({ length: 410 }, (_, index) => ({ id: index }));
    const { calls, peak } = stubPagedApi(items);

    await fetchAllPages("/Sales", undefined, 10);

    expect(calls).toHaveLength(41);
    expect(peak()).toBeLessThanOrEqual(6);
  });

  it("lança quando o total passa do teto, em vez de devolver a lista cortada", async () => {
    // Devolver os primeiros N pareceria uma lista legítima: o cliente sumido
    // viraria "cliente não cadastrado" e a venda faltante, faturamento menor.
    stubPagedApi([{ id: 1 }], FETCH_ALL_PAGES_MAX_ITEMS + 1);

    await expect(fetchAllPages("/Customers")).rejects.toThrow(/teto/);
  });

  it("o erro do teto nomeia o endereço e o total encontrado", async () => {
    stubPagedApi([{ id: 1 }], 123456);

    await expect(fetchAllPages("/Sales")).rejects.toThrow(/\/Sales.*123456/);
  });

  it("aceita teto próprio quando o padrão não serve", async () => {
    stubPagedApi([{ id: 1 }], 10);

    await expect(fetchAllPages("/Images", undefined, 200, { maxItems: 5 })).rejects.toThrow(
      /teto de 5/,
    );
  });

  it("aceita exatamente o total do teto", async () => {
    // Fronteira: o teto é inclusivo — 5.000 passa, 5.001 não.
    const items = Array.from({ length: 3 }, (_, index) => ({ id: index }));
    stubPagedApi(items, 3);

    await expect(fetchAllPages("/Tags", undefined, 200, { maxItems: 3 })).resolves.toHaveLength(3);
  });
});


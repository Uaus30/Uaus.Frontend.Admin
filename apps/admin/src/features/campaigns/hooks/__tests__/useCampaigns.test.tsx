import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGetCampaignByIdQueryKey,
  getGetCampaignsQueryKey,
  getGetCouponsQueryKey,
  type CampaignDto,
} from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetCampaigns: vi.fn(),
  useGetCampaignById: vi.fn(),
  useGetCoupons: vi.fn(),
  createCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  toast: vi.fn(),
  setLocation: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL:
// redefini-las aqui já mascarou uma quebra de invalidação, porque o teste
// passava contra a chave inventada no mock e não contra a que a tela usa.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCampaigns: mocks.useGetCampaigns,
  useGetCampaignById: mocks.useGetCampaignById,
  useGetCoupons: mocks.useGetCoupons,
  createCampaign: mocks.createCampaign,
  updateCampaign: mocks.updateCampaign,
  deleteCampaign: mocks.deleteCampaign,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("wouter", () => ({
  useLocation: () => [null, mocks.setLocation],
}));

const { useCampaigns } = await import("../useCampaigns");
const { emptyQuestionDraft } = await import("../campaignRules");

/** Evento de submit mínimo — o hook só chama `preventDefault`. */
const submitEvent = { preventDefault: () => {} } as unknown as React.FormEvent;

/** Linha da LISTAGEM: o backend nunca manda o questionário aqui. */
const campanhaSetembro: CampaignDto = {
  id: 3,
  createdAt: "2026-08-01T09:00:00",
  updatedAt: null,
  name: "Setembro 2026",
  description: "Panfleto de bairro",
  startsAt: "2026-09-01T08:00:00",
  endsAt: "2026-09-30T23:59:59",
  isActive: true,
  questions: [],
};

/** Detalhe: o questionário com os ids que precisam sobreviver ao salvamento. */
const detalheSetembro: CampaignDto = {
  ...campanhaSetembro,
  questions: [
    {
      id: 7,
      label: "Como conheceu a loja?",
      sortOrder: 1,
      isRequired: true,
      options: [
        { id: 21, label: "Instagram", sortOrder: 1 },
        { id: 22, label: "Panfleto", sortOrder: 2 },
      ],
    },
  ],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

/** Abre a modal em modo de edição e espera o questionário do detalhe hidratar. */
async function renderEditando() {
  const { wrapper, queryClient } = createWrapper();
  const { result } = renderHook(() => useCampaigns(), { wrapper });

  act(() => result.current.handleOpenEdit(campanhaSetembro));
  await waitFor(() => expect(result.current.questions).toHaveLength(1));

  return { result, queryClient };
}

describe("useCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useGetCampaigns.mockReturnValue({
      data: { data: [campanhaSetembro], page: 1, limit: 10, total: 1, totalPages: 1 },
      isLoading: false,
    });
    mocks.useGetCampaignById.mockReturnValue({ data: detalheSetembro, isLoading: false });
    mocks.useGetCoupons.mockReturnValue({
      data: { data: [], page: 1, limit: 20, total: 0, totalPages: 0 },
      isLoading: false,
    });
    mocks.createCampaign.mockResolvedValue({ ...campanhaSetembro, id: 9 });
    mocks.updateCampaign.mockResolvedValue(detalheSetembro);
    mocks.deleteCampaign.mockResolvedValue(undefined);
  });

  it("deve inicializar listando as campanhas da primeira página", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCampaigns(), { wrapper });

    expect(result.current.campaigns).toEqual([campanhaSetembro]);
    expect(result.current.page).toBe(1);
    expect(result.current.modalOpen).toBe(false);
    expect(mocks.useGetCampaigns).toHaveBeenCalledWith({
      search: undefined,
      page: 1,
      limit: 10,
    });
  });

  it("deve hidratar o questionário pela consulta de DETALHE, não pela linha da listagem", async () => {
    const { result } = await renderEditando();

    // A linha da tabela vem com `questions: []`; salvar a partir dela apagaria
    // logicamente o questionário inteiro.
    expect(campanhaSetembro.questions).toEqual([]);
    expect(result.current.questions[0]).toMatchObject({
      id: 7,
      label: "Como conheceu a loja?",
      isRequired: true,
    });
    expect(result.current.questions[0].options.map((option) => option.id)).toEqual([21, 22]);
  });

  it("deve enviar o payload aninhado preservando os Ids das perguntas e opções existentes", async () => {
    const { result } = await renderEditando();

    // Renomeia a opção existente (id preservado), acrescenta uma opção nova
    // (sem id) e uma pergunta nova (sem id).
    act(() => {
      const [pergunta] = result.current.questions;
      result.current.setQuestions([
        {
          ...pergunta,
          options: [
            { ...pergunta.options[0], label: "Instagram / Reels" },
            pergunta.options[1],
            { id: null, key: "nova-opcao", label: "Indicação" },
          ],
        },
        {
          id: null,
          key: "nova-pergunta",
          label: "Já comprou aqui antes?",
          isRequired: false,
          options: [
            { id: null, key: "n1", label: "Sim" },
            { id: null, key: "n2", label: "Não" },
          ],
        },
      ]);
    });

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.updateCampaign).toHaveBeenCalledWith(3, {
        name: "Setembro 2026",
        description: "Panfleto de bairro",
        // Instante montado a partir do dia + hora, nunca por `toISOString()`.
        startsAt: "2026-09-01T08:00:00",
        endsAt: "2026-09-30T23:59:59",
        isActive: true,
        questions: [
          {
            id: 7,
            label: "Como conheceu a loja?",
            sortOrder: 1,
            isRequired: true,
            options: [
              { id: 21, label: "Instagram / Reels", sortOrder: 1 },
              { id: 22, label: "Panfleto", sortOrder: 2 },
              { id: null, label: "Indicação", sortOrder: 3 },
            ],
          },
          {
            id: null,
            label: "Já comprou aqui antes?",
            sortOrder: 2,
            isRequired: false,
            options: [
              { id: null, label: "Sim", sortOrder: 1 },
              { id: null, label: "Não", sortOrder: 2 },
            ],
          },
        ],
      }),
    );
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it("deve derivar o sortOrder da posição depois de reordenar as perguntas", async () => {
    const { result } = await renderEditando();

    act(() => {
      const [pergunta] = result.current.questions;
      result.current.setQuestions([
        {
          id: null,
          key: "nova",
          label: "Já comprou aqui antes?",
          isRequired: false,
          options: [
            { id: null, key: "n1", label: "Sim" },
            { id: null, key: "n2", label: "Não" },
          ],
        },
        pergunta,
      ]);
    });

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() => expect(mocks.updateCampaign).toHaveBeenCalled());
    const [, payload] = mocks.updateCampaign.mock.calls[0];
    expect(payload.questions.map((q: { id: number | null; sortOrder: number }) => q.sortOrder)).toEqual([
      1, 2,
    ]);
    // A pergunta antiga foi para o fim, mas continua sendo a MESMA linha.
    expect(payload.questions[1].id).toBe(7);
  });

  it("deve barrar o submit quando uma pergunta tem menos de 2 opções", async () => {
    const { result } = await renderEditando();

    act(() => {
      const [pergunta] = result.current.questions;
      result.current.setQuestions([{ ...pergunta, options: [pergunta.options[0]] }]);
    });

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.updateCampaign).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Questionário incompleto",
        description: 'A pergunta "Como conheceu a loja?" precisa de pelo menos 2 opções de resposta ativas!',
        variant: "destructive",
      }),
    );
  });

  it("deve tratar opção em branco como não preenchida e barrar o submit", async () => {
    const { result } = await renderEditando();

    act(() => {
      const [pergunta] = result.current.questions;
      result.current.setQuestions([
        { ...pergunta, options: [pergunta.options[0], { ...pergunta.options[1], label: "   " }] },
      ]);
    });

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.updateCampaign).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("deve barrar mais de 6 perguntas antes de chamar a API", async () => {
    const { result } = await renderEditando();

    act(() => {
      result.current.setQuestions(
        Array.from({ length: 7 }, () => ({
          ...emptyQuestionDraft(),
          label: "Pergunta",
          options: [
            { id: null, key: `a-${Math.random()}`, label: "Sim" },
            { id: null, key: `b-${Math.random()}`, label: "Não" },
          ],
        })),
      );
    });

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.updateCampaign).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "A campanha aceita no máximo 6 perguntas!" }),
    );
  });

  it("deve barrar período com fim anterior ao início — comparando instante, não dia", async () => {
    const { result } = await renderEditando();

    // Mesmo DIA, horas invertidas: um confronto por data deixaria passar.
    act(() =>
      result.current.setForm({
        ...result.current.form,
        startsOnDate: new Date(2026, 8, 1),
        startsAtTime: "14:00",
        endsOnDate: new Date(2026, 8, 1),
        endsAtTime: "08:00",
      }),
    );

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.updateCampaign).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Período inválido",
        variant: "destructive",
      }),
    );
  });

  it("deve invalidar campanhas, detalhe e cupons depois de salvar", async () => {
    const { result, queryClient } = await renderEditando();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() => expect(mocks.updateCampaign).toHaveBeenCalled());

    // As chaves são as REAIS do api-client — o mock não redefine nenhuma delas.
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetCampaignsQueryKey() }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetCampaignByIdQueryKey() });
    // A linha do cupom carrega `campaignName`: renomear a campanha sem isto
    // deixaria a tela de cupons exibindo o nome antigo.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetCouponsQueryKey() });
    expect(result.current.modalOpen).toBe(false);
  });

  it("deve criar a campanha com as perguntas sem id quando não há edição", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCampaigns(), { wrapper });

    act(() => result.current.handleOpenCreate());
    act(() =>
      result.current.setForm({
        ...result.current.form,
        name: "  Relâmpago  ",
        startsOnDate: new Date(2026, 8, 12),
        startsAtTime: "14:00",
        endsOnDate: new Date(2026, 8, 12),
        endsAtTime: "20:00",
      }),
    );
    act(() =>
      result.current.setQuestions([
        {
          id: null,
          key: "q1",
          label: " Sexo ",
          isRequired: true,
          options: [
            { id: null, key: "o1", label: "F" },
            { id: null, key: "o2", label: "M" },
          ],
        },
      ]),
    );

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Relâmpago",
          // Campanha de uma tarde: o fim é inclusivo até o último segundo do
          // minuto escolhido.
          startsAt: "2026-09-12T14:00:00",
          endsAt: "2026-09-12T20:00:59",
          questions: [
            expect.objectContaining({
              id: null,
              label: "Sexo",
              sortOrder: 1,
              isRequired: true,
            }),
          ],
        }),
      ),
    );
  });

  it("deve propagar a falha da exclusão para quem confirmou", async () => {
    // A confirmação saiu do hook: quem pergunta é o `ConfirmDialog` da tabela,
    // coberto em `packages/ui`. O que precisa continuar valendo aqui é a
    // REJEIÇÃO — é ela que mantém o diálogo aberto quando o servidor recusa.
    mocks.deleteCampaign.mockRejectedValueOnce(new Error("500"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCampaigns(), { wrapper });

    await expect(
      act(async () => {
        await result.current.handleDelete(campanhaSetembro);
      }),
    ).rejects.toThrow();
  });

  it("deve mostrar a mensagem do backend quando o salvamento é recusado", async () => {
    mocks.updateCampaign.mockRejectedValue(new Error("Pergunta não encontrada nesta campanha!"));
    const { result } = await renderEditando();

    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao salvar a campanha",
          description: "Pergunta não encontrada nesta campanha!",
          variant: "destructive",
        }),
      ),
    );
  });

  it("deve levar ao cadastro de cupom já vinculado à campanha", async () => {
    const { result } = await renderEditando();

    act(() => result.current.handleCreateLinkedCoupon(3));

    expect(mocks.setLocation).toHaveBeenCalledWith("/marketing/cupons?campanha=3&novo=1");
  });
});

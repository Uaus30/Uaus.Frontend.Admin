# Regras Globais para Agentes de IA (AI-First Architecture)

Este arquivo define as diretrizes obrigatórias de comportamento, arquitetura de código, segurança e testes para qualquer agente de IA que manipule este repositório. O objetivo é manter o código modular, desacoplado, documentado e extremamente eficiente (baixo consumo de tokens em janelas de contexto).

---

## 🚨 1. Ações Proibidas (Segurança e Revisão Humana)
*   **PROIBIDO Commitar Automotivamente**: Agentes de IA **nunca** devem executar o comando `git commit` ou `git commit -m` por conta própria.
*   **PROIBIDO Push e PRs Automáticos**: Agentes de IA **nunca** devem empurrar alterações (`git push`) ou criar Pull Requests de forma autônoma.
*   *Nota*: Todas as alterações devem permanecer apenas em ambiente de desenvolvimento local na workspace. A revisão final e o processo de versionamento/deploy cabem exclusivamente ao desenvolvedor humano.

---

## 📂 2. Padrão Arquitetural AI-First no Frontend
Todas as telas e funcionalidades devem ser implementadas usando a seguinte estrutura na pasta `src/features/<feature_name>/`:

1.  **Hooks Customizados (`hooks/use<FeatureName>.ts`)**:
    *   Toda lógica de consultas da API (TanStack/React Query), controle de estado de formulários, paginação e buscas deve residir no hook.
    *   *Regra*: O componente de página/UI **nunca** deve conter mutations ou queries diretas da API.
2.  **Subcomponentes Puros (`components/`)**:
    *   Fragmentar as telas em componentes pequenos e focados (ex: `<FeatureTable>`, `<FeatureEditorModal>`, `<FeatureHeader>`).
    *   Os componentes de apresentação recebem dados e callbacks via props do hook controlador.
3.  **Tamanho de Arquivo Reduzido**:
    *   Evitar arquivos com mais de 300 linhas de código. O isolamento de componentes menores economiza o consumo de tokens na leitura do agente de IA.
4.  **Tipagem Estrita (`types.ts`)**:
    *   Utilizar tipos TypeScript bem delineados. O uso de `any` é estritamente proibido, a menos que seja temporariamente inevitável.

---

## 📝 3. Documentação e Autonomia de Leitura
*   **README Local**: Toda pasta de feature deve ter um `README.md` explicando em português a arquitetura da feature e as regras de negócio em alto nível.
*   **Comentários JSDoc**: Todas as funções exportadas, tipos de formulários e hooks devem conter documentação JSDoc em português descrevendo seus parâmetros, retornos e comportamentos.

---

## 🧪 4. Cobertura de Testes Unitários
*   Toda lógica de negócio crítica, cálculos, validações de inputs e hooks customizados devem ser cobertos por testes unitários usando **Vitest** e **React Testing Library** (ex: `hooks/__tests__/use<FeatureName>.test.ts`).
*   Antes de finalizar a tarefa, a suíte de testes deve ser executada para garantir que não há quebras.

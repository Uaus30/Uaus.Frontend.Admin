# Módulo de Logs (`features/logs`)

Este módulo gerencia a visualização, busca e filtragem avançada de logs do sistema (eventos, requisições e erros), permitindo também o aprofundamento nos detalhes estruturados de cada log individual na página de detalhes. Ele segue o padrão **AI-First** de separação de responsabilidades.

---

## 📂 Estrutura de Arquivos

- `components/LogsFilterBar.tsx`: Barra de filtros contendo busca textual (por código, origem ou mensagem), seletor de tipo de log e o componente de período de datas (`DateRangePicker`).
- `components/LogsTable.tsx`: Tabela que renderiza a lista de logs com colunas de largura fixa e overflow controlado. Traduz o tipo de log em badges de status visuais (ERROR, WARN, INFO, SUCCESS, LOG).
- `hooks/useLogs.ts`: Centraliza o controle de estados draft (editáveis) versus applied (submetidos), paginação, chamadas à API e as formatações e estilizações visuais comuns.
- `types.ts`: Tipagens e contratos locais.

---

## ⚙️ Regras de Negócio Importantes

### 1. Estado Draft vs. Applied

- Para evitar chamadas de API concorrentes e desnecessárias a cada caractere digitado ou clique, o módulo mantém estados temporários (draft) para a busca, tipo e período de datas. As alterações só são realmente aplicadas e enviadas à API quando o usuário clica no botão "Buscar" ou pressiona a tecla "Enter".

### 2. Badges Visuais de Tipos de Log

- Os logs são mapeados visualmente com base na substring do tipo:
  - `ERROR/FAIL/CRIT`: Badge vermelha pulsante de destruição.
  - `WARN`: Badge amarela.
  - `INFO`: Badge azul.
  - `SUCCESS/OK`: Badge verde de sucesso.
  - `Outros`: Badge cinza padrão.
- A API pode entregar `LogType` pelo nome ou pelo valor numérico do enum
  (`Information=1`, `Alert=2`, `Error=3`, `Critical=4`). A tabela aceita os dois
  formatos; valores desconhecidos usam o badge `LOG` e nunca impedem a tela de
  renderizar.

### 3. Detalhes de Log

- No aprofundamento do log (`log-details`), se a propriedade `details` contiver um texto estruturado em JSON válido, ele é automaticamente decodificado e formatado em formato amigável (identado) dentro de um bloco de código com tema escuro.

### 4. Verificação humana de logs críticos

- Todo log `Critical` nasce no backend com `requiresVerification = true`; os demais nascem com `false`.
- Enquanto a pendência estiver aberta, a listagem pinta toda a linha de vermelho vivo. O badge crítico pulsante continua existindo e comunica o tipo, enquanto o fundo comunica o estado operacional.
- O detalhe mostra uma faixa vermelha com a ação **Marcar como verificado**. A ação usa `PUT /Logs/{id}/verification`, é idempotente e não permite editar o conteúdo imutável do log.
- Depois da confirmação, o detalhe passa a exibir uma faixa verde e a listagem é invalidada. Ao voltar, a linha usa o visual normal dos demais logs.
- Não crítico nunca oferece essa ação. Justificativa, reabertura e metadados específicos de verificação não fazem parte deste primeiro controle; `updatedAt` e a auditoria interna do backend registram a alteração.

# Contato

Página de contato do site — formulário e canais diretos.

## Regra de negócio central: o site não envia nada

O formulário **não tem backend**. Validou, ele monta a mensagem e abre o
WhatsApp da loja com o texto pré-preenchido; quem envia é o visitante, no app
dele, depois de conferir. Três motivos, em ordem de peso:

1. **O canal real de conversão da loja é o WhatsApp** — era o CTA dominante do
   site antigo e é onde a lojista de fato responde.
2. O formulário do site antigo postava num Express próprio com **senha de app
   do Gmail hardcoded no código** e gravava num Postgres paralelo que ninguém
   lia. Reproduzir isso exigiria mailer + tabela + tela no admin.
3. Sem envio automático não há spam de bot para mitigar.

Se um dia fizer falta um registro persistido das mensagens, o caminho é um
endpoint público no backend + tela no admin — está no backlog do
`PLANO-APP-LOJA.md`, não improvise um terceiro caminho.

## Detalhes

- Telefone é opcional (a conversa já acontece no número do visitante); quando
  preenchido, valida 10–13 dígitos.
- Erro de campo some ao voltar a digitar nele.
- Endereço/telefone exibidos preferem o cadastro de Configurações da Empresa
  (endpoint público `/Storefront/company`) com fallback em `lib/site.ts`.
- Validação em `hooks/useContactForm.ts` (`validateContactFields`), coberta em
  `hooks/__tests__/`.

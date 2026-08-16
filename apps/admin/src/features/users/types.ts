import type { UserListDto } from "@workspace/api-client-react";

/**
 * Campos do formulário de Usuários.
 *
 * `role` e `status` são string porque o `<Select>` do shadcn trabalha com string;
 * a conversão para o código numérico acontece no envio. **Não há campo de senha**:
 * o cadastro nasce com a senha padrão do sistema e a troca é do próprio usuário,
 * no primeiro acesso. Ver o README da feature.
 */
export interface UserForm {
  fullName: string;
  username: string;
  email: string;
  role: string;
  status: string;
}

/**
 * Credenciais do primeiro acesso, mostradas depois de cadastrar ou resetar.
 *
 * A senha vem do servidor, nunca de uma constante na tela: ela sai da
 * `System:DefaultPassword` do appsettings, e uma cópia aqui passaria a mentir
 * silenciosamente no dia em que aquele valor mudasse.
 */
export interface FirstAccessInfo {
  username: string;
  password: string;
  /** Cadastro novo ou reset de senha — muda só o texto da modal. */
  origem: "cadastro" | "reset";
}

/** Usuário como a listagem o entrega. */
export type UserRow = UserListDto;

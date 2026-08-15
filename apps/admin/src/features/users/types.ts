/**
 * Interface que representa os campos do formulário de Usuários.
 */
export interface UserForm {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: string;
  status: string;
}

/**
 * Interface para opções de enums da API.
 */
export type { EnumOptionDto as EnumOption } from "@workspace/api-client-react";

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
export interface EnumOption {
  id: number;
  name: string;
  value: string;
  allowSelect: boolean;
}

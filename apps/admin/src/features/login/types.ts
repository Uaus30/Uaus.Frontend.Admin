/**
 * Interface que representa os campos preenchidos no formulário de Login.
 */
export interface LoginFormValues {
  /** Identificador do usuário (usuário ou e-mail). */
  identifier: string;
  /** Senha de acesso. */
  password: string;
}

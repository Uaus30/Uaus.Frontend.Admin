/**
 * Caminho da tela inicial do admin — a grade de atalhos (05/10/2026).
 *
 * Vive aqui, e não como string solta, porque quatro lugares mandam para ela: a
 * raiz `/`, o destino padrão do login, o botão da 404 e o "Início" da tela de
 * erro. Até 05/10/2026 os quatro apontavam para `/dashboard`, cada um com a sua
 * cópia da string — trocar o destino era caçar as cópias.
 */
export const HOME_PATH = "/inicio";

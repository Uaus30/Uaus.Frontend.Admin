/**
 * Glifo do Instagram no traço do lucide (stroke 2, cantos redondos).
 *
 * Existe localmente porque o lucide-react removeu os ícones de MARCA na v1 —
 * `Instagram` compilava no site antigo (lucide 0.x) e não existe mais no
 * pacote que o monorepo usa.
 */
export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

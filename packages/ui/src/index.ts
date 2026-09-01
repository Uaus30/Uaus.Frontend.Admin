export * from "./components/alert-dialog";
export * from "./components/alert";
export * from "./components/badge";
export * from "./components/button";
export * from "./components/calendar";
export * from "./components/card";
export * from "./components/chart";
export * from "./components/checkbox";
export * from "./components/collapsible";
export * from "./components/command";
export * from "./components/confirm-dialog";
export * from "./components/context-menu";
export * from "./components/date-field";
export * from "./components/date-picker";
export * from "./components/date-range-picker";
export * from "./components/dev-environment-banner";
export * from "./components/dialog";
export * from "./components/dropdown-menu";
export * from "./components/hover-card";
export * from "./components/input";
export * from "./components/item";
export * from "./components/label";
export * from "./components/not-found-screen";
export * from "./components/pagination";
export * from "./components/popover";
export * from "./components/scroll-area";
export * from "./components/select";
export * from "./components/separator";
export * from "./components/sheet";
export * from "./components/sidebar";
export * from "./components/skeleton";
export { Toaster as SonnerToaster } from "./components/sonner";
export * from "./components/spinner";
export * from "./components/switch";
export * from "./components/table";
export * from "./components/table-pagination";
export * from "./components/tabs";
export * from "./components/textarea";
export * from "./components/toast";
export * from "./components/toaster";
export * from "./components/toggle";
export * from "./components/tooltip";
export * from "./lib/chunk-reload";
export * from "./lib/environment";
export * from "./lib/utils";

// Hooks que os componentes deste pacote consomem.
//
// Moraram em `apps/*/src/hooks/` até ago/2026, e o sidebar/toaster os importavam
// por `@/hooks/...` — um alias que só resolve DENTRO de um app. O pacote só
// compilava porque cada app mantinha um arquivo com o nome exato no caminho
// exato, e apagar o do admin (que não tinha nenhum importador próprio) quebraria
// o build sem nada apontando o motivo.
export * from "./hooks/use-mobile";
export * from "./hooks/use-toast";
export * from "./hooks/use-debounce";
export * from "./hooks/use-page-title";

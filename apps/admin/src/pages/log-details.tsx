import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui";
import { useGetLog } from "@workspace/api-client-react";
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Loader2, 
  Terminal,
  Calendar,
  Hash,
  Globe,
  Tag
} from "lucide-react";
import { useToast } from "@workspace/ui";
import { getLogTypeBadge } from "@/features/logs/components/LogsTable";
import { formatDateTime } from "@/features/logs/hooks/useLogs";
import { describeApiError } from "@workspace/core";

/**
 * Página de Detalhes de um Registro de Log específico.
 * Consome os helpers e componentes exportados da feature de logs para manter consistência visual e lógica.
 */
export default function LogDetails() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: log, isLoading, isError, error } = useGetLog(Number(id));

  useEffect(() => {
    if (isError && error) {
      toast({
        title: "Erro ao carregar detalhes do log",
        description: describeApiError(error, "Log não encontrado."),
        variant: "destructive",
      });
      setLocation("/sistema/logs");
    }
  }, [isError, error, toast, setLocation]);

  function copyToClipboard(text: string, field: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({
      title: "Copiado para a área de transferência",
      description: "Conteúdo copiado com sucesso.",
    });
    setTimeout(() => setCopiedField(null), 2000);
  }

  const formattedDetails = (() => {
    if (!log?.details) return null;
    try {
      const parsed = JSON.parse(log.details);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return log.details;
    }
  })();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!log) return null;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="hover-elevate bg-card border border-border"
              onClick={() => setLocation("/sistema/logs")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-display font-bold">Log #{log.id}</h1>
                {getLogTypeBadge(log.type)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Detalhes completos do registro de log do sistema.</p>
            </div>
          </div>

          <Button
            variant="outline"
            className="gap-2 hover-elevate bg-card border-border shrink-0 self-start sm:self-center"
            onClick={() => copyToClipboard(JSON.stringify(log, null, 2), "all")}
          >
            {copiedField === "all" ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" /> Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copiar Tudo
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" /> Informações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3 rounded-lg border border-border/40 bg-muted/10">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Criado Em
                  </div>
                  <div className="text-sm font-medium font-mono text-foreground">
                    {formatDateTime(log.createdAt)}
                  </div>
                </div>

                <div className="space-y-1.5 p-3 rounded-lg border border-border/40 bg-muted/10">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    <Tag className="h-3.5 w-3.5 text-primary" /> Código do Evento
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-medium text-foreground">{log.code || "-"}</span>
                    {log.code && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 hover:bg-muted"
                        onClick={() => copyToClipboard(log.code, "code")}
                      >
                        {copiedField === "code" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 p-3 rounded-lg border border-border/40 bg-muted/10 md:col-span-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                    <Globe className="h-3.5 w-3.5 text-primary" /> Origem / Recurso
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-mono text-foreground break-all">{log.origin || "-"}</span>
                    {log.origin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 hover:bg-muted shrink-0"
                        onClick={() => copyToClipboard(log.origin, "origin")}
                      >
                        {copiedField === "origin" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    )}
                  </div>
                </div>

                {log.requestId && (
                  <div className="space-y-1.5 p-3 rounded-lg border border-border/40 bg-muted/10 md:col-span-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                      <Hash className="h-3.5 w-3.5 text-primary" /> Request ID
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono text-foreground select-all">{log.requestId}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 hover:bg-muted"
                        onClick={() => copyToClipboard(log.requestId || "", "requestId")}
                      >
                        {copiedField === "requestId" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Mensagem</div>
                <div className="p-4 rounded-xl border border-border bg-background/50 font-sans text-sm leading-relaxed text-foreground break-words whitespace-pre-wrap select-text">
                  {log.message || "-"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/60 backdrop-blur-sm shadow-sm flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Hash className="h-5 w-5 text-primary" /> Detalhes
              </CardTitle>
              {log.details && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-1 hover-elevate bg-background"
                  onClick={() => copyToClipboard(log.details || "", "details")}
                >
                  {copiedField === "details" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px] flex">
              {log.details ? (
                <pre className="flex-1 p-4 rounded-xl border border-border bg-zinc-950 text-zinc-100 font-mono text-xs overflow-auto max-h-[500px] w-full select-text selection:bg-zinc-800">
                  {formattedDetails}
                </pre>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6 text-center border border-dashed border-border rounded-xl">
                  <Terminal className="h-8 w-8 opacity-20 mb-2" />
                  <span className="text-sm">Nenhum detalhe adicional disponível para este log.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}



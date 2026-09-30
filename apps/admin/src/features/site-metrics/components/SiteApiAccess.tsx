import { Bot, ShieldAlert } from "lucide-react";
import { Card } from "@workspace/ui";
import type { ApiAccessOverviewDto } from "@workspace/api-client-react";
import { formatCount } from "../lib/site-metrics";

/** `yyyy-MM-ddTHH:mm:ss` → "30/09 15:04". */
function formatSeen(value: string): string {
  const [date, time] = value.split("T");
  const [, month, day] = (date ?? "").split("-");
  return `${day}/${month} ${(time ?? "").slice(0, 5)}`;
}

/**
 * Quem bateu na API sem token: robô, scanner e quem chama direto — gente que o
 * coletor do site nunca vê, porque não executa o JavaScript da loja. É a
 * resposta ao "acesso mal-intencionado" do pedido do dono.
 *
 * A leitura é por assinatura, não por volume: muitos 404 é scanner procurando
 * WordPress; muitos 401 é alguém tentando rota interna; 429 é quem estourou o
 * limite do coletor. Um visitante de verdade gera dezenas de chamadas em
 * `/Storefront` e zero 404.
 */
export function SiteApiAccess({ access }: { access: ApiAccessOverviewDto }) {
  // Vem do servidor, contado sobre todos os IPs do período: um scanner que
  // bateu uma vez fica fora dos 25 maiores da tabela e é justamente o que
  // este número precisa denunciar.
  const suspicious = access.suspiciousIps;

  return (
    <Card className="border-border/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Acessos à API sem login</h3>
          <p className="text-xs text-muted-foreground">
            Toda chamada sem token, por IP — inclui o site, robôs e scanners. Atualiza a cada minuto.
          </p>
        </div>
        <div className="flex gap-4 text-right text-sm tabular-nums">
          <div>
            <p className="text-xs text-muted-foreground">Chamadas</p>
            <p className="font-semibold">{formatCount(access.requests)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">IPs</p>
            <p className="font-semibold">{formatCount(access.distinctIps)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Com sinal de abuso</p>
            <p className={`font-semibold ${suspicious > 0 ? "text-amber-500" : ""}`}>
              {formatCount(suspicious)}
            </p>
          </div>
        </div>
      </div>

      {access.topIps.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Nenhuma chamada registrada no período.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-1 font-medium">IP</th>
                <th className="pb-1 text-right font-medium">Chamadas</th>
                <th className="pb-1 text-right font-medium" title="Chamadas ao /Storefront, o que o site usa">
                  Site
                </th>
                <th className="pb-1 text-right font-medium" title="Rota inexistente: assinatura de scanner">
                  404
                </th>
                <th className="pb-1 text-right font-medium" title="Tentou rota interna sem token">
                  401
                </th>
                <th className="pb-1 text-right font-medium" title="Estourou o limite por IP">
                  429
                </th>
                <th className="pb-1 font-medium">Último caminho</th>
                <th className="pb-1 font-medium">Visto</th>
              </tr>
            </thead>
            <tbody>
              {access.topIps.map((ip) => {
                const abuse = ip.notFound > 0 || ip.unauthorized > 0 || ip.rateLimited > 0;
                return (
                  <tr key={ip.ip} className="border-t border-border/40" title={ip.lastUserAgent ?? undefined}>
                    <td className="py-1 font-mono text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        {abuse && (
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-500" aria-label="sinal de abuso" />
                        )}
                        {ip.isBot && (
                          <Bot className="h-3.5 w-3.5 text-muted-foreground" aria-label="se declara robô" />
                        )}
                        {ip.ip}
                      </span>
                    </td>
                    <td className="py-1 text-right tabular-nums">{formatCount(ip.requests)}</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">
                      {formatCount(ip.storefrontRequests)}
                    </td>
                    <td
                      className={`py-1 text-right tabular-nums ${ip.notFound > 0 ? "text-amber-500" : "text-muted-foreground"}`}
                    >
                      {formatCount(ip.notFound)}
                    </td>
                    <td
                      className={`py-1 text-right tabular-nums ${ip.unauthorized > 0 ? "text-amber-500" : "text-muted-foreground"}`}
                    >
                      {formatCount(ip.unauthorized)}
                    </td>
                    <td
                      className={`py-1 text-right tabular-nums ${ip.rateLimited > 0 ? "text-amber-500" : "text-muted-foreground"}`}
                    >
                      {formatCount(ip.rateLimited)}
                    </td>
                    <td className="max-w-[16rem] truncate py-1 font-mono text-xs text-muted-foreground">
                      {ip.lastPath ?? "—"}
                    </td>
                    <td className="py-1 text-xs whitespace-nowrap text-muted-foreground">
                      {formatSeen(ip.lastSeen)}
                      {ip.days > 1 && ` · ${ip.days} dias`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

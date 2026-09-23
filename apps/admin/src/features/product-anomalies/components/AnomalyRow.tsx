import type { ReactNode } from "react";
import { ExternalLink, ImageIcon } from "lucide-react";
import { ImageHoverZoom } from "@workspace/ui";
import { formatQuantity } from "@workspace/core";
import {
  buildPublicImageUrl,
  type ProductAnomalyDto,
  type ProductAnomalyRowDto,
} from "@workspace/api-client-react";
import { productDetailPathname, productStockTabPathname } from "@/features/products/product-detail-route";
import { AnomalyTag } from "./AnomalyTag";
import { anomalyMeta, describeAnomaly, variationLabel, zeroCostIsCorrectable } from "../lib/anomalies";

/**
 * Link que abre o cadastro em nova aba. Âncora simples, sem o roteador da SPA:
 * a lista não pode se perder por causa de um clique de correção — é o mesmo
 * padrão do ranking de "O que trouxe lucro".
 */
function NewTabLink({
  href,
  label,
  title,
  children,
}: {
  href: string;
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={title}
      className="inline-flex shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </a>
  );
}

/**
 * O atalho da etiqueta, quando a correção mora num lugar específico do cadastro:
 * a aba Estoque na variação certa (contagem física e custo da última entrada), ou
 * o outro cadastro de mesmo nome.
 */
function AnomalyAction({ anomaly, row }: { anomaly: ProductAnomalyDto; row: ProductAnomalyRowDto }) {
  const corrigivelPelaTela =
    anomaly.type === "PhantomStock" || (anomaly.type === "ZeroCost" && zeroCostIsCorrectable(anomaly));
  if (corrigivelPelaTela && anomaly.productId != null) {
    const acao = anomaly.type === "PhantomStock" ? "Contar" : "Corrigir custo";
    return (
      <NewTabLink
        href={productStockTabPathname(row.productGroupId, anomaly.productId)}
        label={`${acao}: abrir a aba Estoque de ${anomaly.productName ?? row.name}, em nova aba`}
        title="Abrir a aba Estoque do produto"
      >
        <span className="text-[11.5px] font-medium underline-offset-2 hover:underline">{acao}</span>
        <ExternalLink className="h-3 w-3" />
      </NewTabLink>
    );
  }

  if (anomaly.type === "DuplicateName" && anomaly.duplicateGroupIds?.length) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {anomaly.duplicateGroupIds.map((id) => (
          <NewTabLink
            key={id}
            href={productDetailPathname(id)}
            label={`Abrir o outro cadastro de mesmo nome, #${id}, em nova aba`}
            title="Abrir o outro cadastro"
          >
            <span className="text-[11.5px] font-medium">#{id}</span>
            <ExternalLink className="h-3 w-3" />
          </NewTabLink>
        ))}
      </span>
    );
  }

  return null;
}

/** Uma linha: o cadastro, e cada anomalia com a evidência dela e o que fazer. */
export function AnomalyRow({ row }: { row: ProductAnomalyRowDto }) {
  return (
    <li className="flex gap-3 rounded-lg border border-border/60 px-3.5 py-3">
      {row.imageUrl ? (
        <ImageHoverZoom
          src={buildPublicImageUrl(row.imageUrl)}
          alt=""
          className="h-10 w-10 shrink-0 rounded-md border border-border/50 bg-white object-contain"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/40">
          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[14px] font-semibold leading-snug" title={row.name}>
                {row.name}
              </p>
              <NewTabLink
                href={productDetailPathname(row.productGroupId)}
                label={`Abrir ${row.name} no cadastro, em nova aba`}
                title="Abrir no cadastro do produto"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </NewTabLink>
            </div>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {[row.categoryName, row.hasVariations ? "com variações" : null].filter(Boolean).join(" · ") ||
                "sem categoria"}
            </p>
          </div>
          <p className="shrink-0 text-[12px] text-muted-foreground">
            {row.stock > 0 ? `${formatQuantity(row.stock)} em estoque` : "sem estoque"}
          </p>
        </div>

        <ul className="mt-2 flex flex-col gap-2">
          {row.anomalies.map((anomaly, indice) => {
            const variacao = variationLabel(anomaly, row);
            return (
              <li
                key={`${anomaly.type}-${anomaly.productId ?? "grupo"}-${indice}`}
                className="flex flex-col gap-1"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <AnomalyTag type={anomaly.type} />
                  {variacao && (
                    <span className="text-[11.5px] font-medium text-foreground/80">{variacao}</span>
                  )}
                  <AnomalyAction anomaly={anomaly} row={row} />
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {describeAnomaly(anomaly, row)}{" "}
                  <span className="text-foreground/70">{anomalyMeta(anomaly.type).fix}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

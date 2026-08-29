import { useState } from "react";
import { ImageOff } from "lucide-react";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  /** Classes da imagem em si (o wrapper de fallback as reaproveita). */
  className?: string;
  loading?: "eager" | "lazy";
}

/**
 * Imagem de produto com fallback.
 *
 * As URLs vêm do S3 e são estáveis, mas arquivo removido e produto sem foto
 * são estados normais do catálogo — o placeholder com `ImageOff` evita o ícone
 * de imagem quebrada do navegador, que faz a loja inteira parecer defeituosa.
 */
export function ProductImage({ src, alt, className, loading = "lazy" }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const [lastSrc, setLastSrc] = useState(src);

  // Nova URL (troca de produto ou de imagem na galeria) ganha nova chance.
  // Ajuste DURANTE o render, não em efeito: é o padrão do React para derivar
  // estado de prop sem um frame intermediário com o estado velho.
  if (lastSrc !== src) {
    setLastSrc(src);
    setFailed(false);
  }

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-orange-50 text-orange-200 ${className ?? ""}`}>
        <ImageOff aria-hidden className="h-12 w-12" />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

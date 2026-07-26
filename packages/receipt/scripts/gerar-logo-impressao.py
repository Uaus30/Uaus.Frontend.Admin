"""
Gera a versão de impressão da logo a partir da arte original.

Por que existe
--------------
A logo original é laranja. Impressora térmica não imprime cor: ela converte o
tom em pontinhos espalhados (meio-tom), e o laranja — que é claro — vira uma
mancha rala que sai quase apagada no papel.

Este script reduz a arte a duas cores puras: onde havia cor, tinta cheia; onde
havia branco, papel limpo. Sem meio-tom, a cabeça térmica queima o ponto inteiro
e a logo sai sólida.

Como usar
---------
    cd packages/receipt
    python scripts/gerar-logo-impressao.py

Depois, embuta o resultado em src/logo.ts:

    python -c "import base64;print(base64.b64encode(open('assets/logo-uaus-print.png','rb').read()).decode())"

Requer Pillow (`pip install Pillow`).
"""

from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "assets"
SOURCE = ASSETS / "logo-uaus.png"
TARGET = ASSETS / "logo-uaus-print.png"

# Abaixo deste alfa o pixel é fundo e continua transparente (papel limpo).
#
# O corte é baixo de propósito: as bordas suavizadas da arte têm alfa parcial, e
# um limite alto as descartaria, afinando os traços justamente no tamanho em que
# eles já são finos (16 mm no cupom).
ALPHA_THRESHOLD = 48

# Acima desta luminância o pixel é considerado branco da arte — o "U" e a alça,
# que são recortes e devem sair como papel, não como tinta.
LUMINANCE_THRESHOLD = 170

BLACK = (0, 0, 0, 255)
TRANSPARENT = (0, 0, 0, 0)


def luminance(red: int, green: int, blue: int) -> float:
    """Luminância percebida (Rec. 601), que é como o olho pesa cada canal."""
    return 0.299 * red + 0.587 * green + 0.114 * blue


def to_print_version(image: Image.Image) -> Image.Image:
    """Reduz a arte a tinta cheia ou papel limpo, sem tons intermediários."""
    source = image.convert("RGBA")
    result = Image.new("RGBA", source.size)

    pixels = source.load()
    output = result.load()

    for y in range(source.height):
        for x in range(source.width):
            red, green, blue, alpha = pixels[x, y]

            if alpha < ALPHA_THRESHOLD:
                output[x, y] = TRANSPARENT
                continue

            # Recorte claro da arte (o "U" e o vão da alça): vira papel, não tinta.
            if luminance(red, green, blue) > LUMINANCE_THRESHOLD:
                output[x, y] = TRANSPARENT
                continue

            output[x, y] = BLACK

    return result


def main() -> None:
    with Image.open(SOURCE) as image:
        to_print_version(image).save(TARGET, optimize=True)

    print(f"Gerado: {TARGET.relative_to(ASSETS.parent)}")


if __name__ == "__main__":
    main()

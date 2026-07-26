/**
 * Logo da loja embutida como data URI para o cupom.
 *
 * O cupom é impresso dentro de um iframe isolado, então uma URL relativa
 * poderia não resolver a tempo da chamada de print(). Embutir o PNG elimina
 * qualquer corrida de carregamento e mantém o pacote independente do app.
 *
 * **Esta é a versão de impressão, em preto sólido — não a arte original.**
 * Impressora térmica não imprime cor: ela converte o tom em pontinhos
 * espalhados, e o laranja da marca, por ser claro, saía ralo e quase apagado no
 * papel. A versão embutida aqui tem só duas cores — tinta cheia onde havia cor,
 * papel limpo onde havia branco —, então a cabeça térmica queima o ponto inteiro.
 *
 * Origem: packages/receipt/assets/logo-uaus-print.png, derivada de
 * assets/logo-uaus.png (a arte original, que continua no repositório).
 *
 * Para regerar depois de trocar a arte:
 *   cd packages/receipt
 *   python scripts/gerar-logo-impressao.py
 *   python -c "import base64;print(base64.b64encode(open('assets/logo-uaus-print.png','rb').read()).decode())"
 */
export const STORE_LOGO_DATA_URI =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAH4AAACECAYAAABWKp/3AAACp0lEQVR42u3dS5bbMAxEUQHH+98ysoGMOpGbRN2aemAST0WCH0HP" +
  "Q0Q5qqC+jphkdHLEKKdTI15ZHRlxy+rAiF1e40cMf64GfVVb1j6tI5Z5jh/ty3tK54t9nYSYbgdfl/4v8D8Mfi1sQxT4Oaw/syW+" +
  "DXrmlm0/tp7f/K8B/j23lykyz/F1wX8P8PsuTBTH01Wub253OkdBagnd19o0wBPwt19oAJ5cxBBcgTScH8qjwM58AAr0zAegAM+E" +
  "3wddlap/+P0UQPUCxHnDSH3Z3bRa4MratpwbS7pX+zCb1vHlDZrfgd+SuSfybN+W7WOv/mS3p87rMXv1teClj78t6+q04b4OaEQt" +
  "yCfq4JdAX3H8SAzv7EMd1OFaENxv96G23MCZyx11TR/KMJ25UmjQreMJeNq+mgA+VJ+LExQ5xsVBv31VUbeWVTfUS+4oKcEDnuMl" +
  "VcAT8LRzngee4wl4iR3wBDwtSvCA53gCXmIHPO2c54HneALe/A48AU+LEjzgOZ6Al9gBTzvneeA5noA3v3M8AU+LEjzgOZ6Al9hx" +
  "PD0rCyu3UqCZCV5znaGegDcEby8F2yBkzvOt1nvmg9aG3szRpRfN7+VrFvc5fi6AX5ZzWc7/nx80nlOM1UuHwOLy5/jq1d9w/hwA" +
  "/Ohv0kxIkjYH/OevxjUVfOpeRZ2c3A3ouVm9s4Lg5ZxPj34J/AhcTttbADPb3AIZ1da5cct2nns/KMzxS4M7svqsQM+tCehnQdZc" +
  "HJ55SDNB++3Af/HgZRxd7r+kMSn9/zyPq8ZP+F69++kOaQh4igBvuA9JbDme4ylpGdvePuV48IM2rQz1oTuVreCAoR78oHOJVmok" +
  "s0ZPqzOT+Zp4Od3KrAtQjjczi0GU8+3M6h+uJ4WWeik3XVTzIqLt+gO+xYjd36Z1hQAAAABJRU5ErkJggg==";

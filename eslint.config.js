import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Lint do monorepo inteiro — os dois apps e os quatro packages.
 *
 * É um arquivo só de propósito. Enquanto cada app tinha o seu, as regras
 * divergiam em silêncio: o admin não tinha lint nenhum e acumulou 126 `any`,
 * enquanto o PDV rodava com `no-explicit-any` ligado e tem zero.
 *
 * Duas escolhas que valem explicação:
 *
 * `no-explicit-any` é ERRO. As 232 violações que já existiam estão registradas
 * em eslint-suppressions.json — um arquivo que só pode encolher. Código novo com
 * `any` quebra o pipeline; o legado sai aos poucos. Depois de limpar algumas,
 * rode `npm run lint:prune` para tirá-las do arquivo e travar o ganho.
 *
 * `max-lines` é WARNING. O teto de 300 linhas do CLAUDE.md vale para código
 * novo, mas 33 arquivos passam dele hoje (pdv.tsx tem 1.8k). Como erro, o
 * pipeline nasceria vermelho e a regra seria desligada na semana seguinte.
 */
export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    'apps/*/public/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      // Warning porque dependência de efeito exige julgamento: há casos
      // legítimos de omitir uma, e cada um precisa de comentário explicando o
      // porquê. Como erro, o caminho fácil seria o eslint-disable.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Arquivo de teste grande é cobertura, não acoplamento — fatiá-lo só para
    // caber no teto pioraria a leitura.
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    rules: {
      'max-lines': 'off',
    },
  },
  {
    // Os packages não são componentes de tela; a regra do Fast Refresh não se
    // aplica a um barrel de utilitários nem a um kit que exporta variantes.
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Configs de build rodam em Node, não no navegador.
    files: ['**/*.config.{ts,js}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])

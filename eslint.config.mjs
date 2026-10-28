import nextVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'

export default [
  ...nextVitals,
  prettier,
  {
    files: ['src/**/*.{js,jsx,mjs}'],
    rules: {
      'react/prop-types': 'off',
      'react/display-name': 'off',
      '@next/next/no-img-element': 'off',
      'no-unused-vars': 'warn',
      'import/no-unresolved': ['error', { caseSensitive: false }]
    },
    settings: {
      'import/resolver': {
        alias: {
          extensions: ['.js', '.jsx', '.mjs'],
          map: [['@', './src']]
        }
      }
    }
  }
]

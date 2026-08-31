// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    languageOptions: {
      // El análisis con tipos es obligatorio para `consistent-type-imports`:
      // sin él la regla no distingue una interfaz de una clase inyectada y
      // convertiría en `import type` dependencias que Nest necesita en runtime.
      parserOptions: { sourceType: 'module', projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Imprescindible con Bun en la cadena de herramientas (`bun test`, el
      // guion de siembra): su transpilador procesa cada fichero por separado y
      // no puede deducir qué importaciones son solo de tipos, así que las
      // emitiría como importaciones reales y fallarían en tiempo de ejecución.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          // Permite `const { secreto, ...resto } = dto` para omitir campos.
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/explicit-member-accessibility': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);

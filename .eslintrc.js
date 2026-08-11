module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true,
  },
  ignorePatterns: ['./src/docs'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    // Not tsconfig.json — that one only covers the files the app imports.
    project: './tsconfig.eslint.json',
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/member-delimiter-style': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    // CI lints with --max-warnings 0, so a deliberately unused argument needs a
    // way to say so. Prefix it with an underscore.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react/no-unescaped-entities': 'off',
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'linebreak-style': ['error', 'unix'],
    indent: 'off',
    quotes: 'off',
  },
  settings: {
    react: {
      version: '16.13',
    },
  },
};

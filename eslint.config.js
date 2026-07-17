export default [
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        createImageBitmap: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },
];

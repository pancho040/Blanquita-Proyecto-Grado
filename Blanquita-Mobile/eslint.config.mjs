import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Promise: "readonly",
        Date: "readonly",
        Math: "readonly",
        JSON: "readonly",
        Number: "readonly",
        String: "readonly",
        Boolean: "readonly",
        Array: "readonly",
        Object: "readonly",
        Error: "readonly",
        require: "readonly",
        module: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __DEV__: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-undef": "error",
      "no-console": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "build/**",
    ],
  },
];

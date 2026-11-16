import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";

const customRulesPlugin = {
  rules: {
    "no-var-before-define": {
      meta: {
        type: "problem",
        docs: {
          description: "Evitar uso de variables/constantes antes de su declaracion lexica (riesgo TDZ)",
        },
        schema: [],
      },
      create(context) {
        function checkScope(scope) {
          for (const variable of scope.variables) {
            const def = variable.defs[0];
            if (!def || def.type !== "Variable") continue;
            const init = def.node?.init;
            // Permitir funciones flecha y function expressions
            const isFunction = init && (
              init.type === "ArrowFunctionExpression" ||
              init.type === "FunctionExpression"
            );
            if (isFunction) continue;

            const declRange = def.name.range[0];
            for (const ref of variable.references) {
              // Si la referencia ocurre antes en el archivo que la declaracion
              if (ref.identifier.range[0] < declRange) {
                context.report({
                  node: ref.identifier,
                  message: `'${ref.identifier.name}' fue usado antes de su declaracion lexica (riesgo TDZ).`,
                });
              }
            }
          }
          for (const child of scope.childScopes) {
            checkScope(child);
          }
        }
        return {
          "Program:exit"(node) {
            const scope = context.sourceCode ? context.sourceCode.getScope(node) : context.getScope();
            checkScope(scope);
          },
        };
      },
    },
  },
};

export default [
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      custom: customRulesPlugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: "readable",
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "no-undef": "error",
      "react/jsx-no-undef": "error",
      "custom/no-var-before-define": "error",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

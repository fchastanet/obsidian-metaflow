import {defineConfig, globalIgnores} from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import jest from "eslint-plugin-jest";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([
  globalIgnores([".history/**", "node_modules/**", "dist/**", "out/**", ".obsidian/**", ".vscode/**"]),
  {
    extends: compat.extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/eslint-recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:jest/recommended",
    ),

    plugins: {
      "@typescript-eslint": typescriptEslint,
      jest,
    },

    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "module",
    },

    rules: {
      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": ["error", {
        args: "none",
      }],

      "@typescript-eslint/ban-ts-comment": "off",
      "no-prototype-builtins": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "no-case-declarations": "warn",
      "no-var": "error",
      "prefer-const": "error",
      "no-extra-semi": "error",
    },
  }, {
    files: ["**/*.test.ts", "**/*.spec.ts", "src/__mocks__/**/*.ts"],

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        ...jest.environments.globals.globals,
      },
    },

    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

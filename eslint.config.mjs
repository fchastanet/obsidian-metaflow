// @ts-check

import eslint from '@eslint/js';
import tsparser from "@typescript-eslint/parser";
import {defineConfig} from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from 'typescript-eslint';


export default defineConfig([
  eslint.configs.recommended,
  tseslint.configs.recommended,
  // @ts-ignore
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {project: "./tsconfig.json"},
    },

    // You can add your own configuration to override or add rules
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "args": "none"
        }
      ],
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
      "no-extra-semi": "error"
    },
    ignores: [
      'node_modules/',
      'main.js'
    ]
  },
]);

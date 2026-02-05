"use strict";

const js = require("@eslint/js");
const prettierConfig = require("eslint-config-prettier/flat");

module.exports = [
  {
    ignores: [
      "node_modules/",
      ".env",
      ".env.*",
      "*.min.js",
      "package-lock.json",
      "cloudinary-resources.json",
      "alt-tags.json",
      "downloads/",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        console: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
  },
  prettierConfig,
];

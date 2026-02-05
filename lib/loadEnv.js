"use strict";

const path = require("path");

/**
 * Load environment variables from .env in the project root (current working directory).
 * Call this at the very start of any entry script so process.env is populated before config.
 */
function loadEnv() {
  const result = require("dotenv").config({
    path: path.resolve(process.cwd(), ".env"),
  });
  if (result.error && result.error.code !== "ENOENT") {
    console.error("[tagger] dotenv warning:", result.error.message);
  }
  return result;
}

module.exports = { loadEnv };

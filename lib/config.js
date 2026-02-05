"use strict";

const path = require("path");

function parseArgs(argv) {
  const args = argv !== undefined ? argv : process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) opts.input = args[++i];
    else if (args[i] === "--output" && args[i + 1]) opts.output = args[++i];
    else if (args[i] === "--download-dir" && args[i + 1])
      opts.downloadDir = args[++i];
    else if (args[i] === "--delay-ms" && args[i + 1])
      opts.delayMs = parseInt(args[++i], 10);
    else if (args[i] === "--limit" && args[i + 1])
      opts.limit = parseInt(args[++i], 10);
    else if (args[i] === "--verbose" || args[i] === "-v") opts.verbose = true;
  }
  return opts;
}

function getConfig(argv) {
  const env = process.env;
  const cli = parseArgs(argv);
  const cwd = process.cwd();
  const verbose =
    cli.verbose ||
    (env.TAGGER_VERBOSE !== undefined && env.TAGGER_VERBOSE !== "");

  return {
    inputPath: path.resolve(
      cwd,
      cli.input || env.TAGGER_INPUT || "cloudinary-resources.json",
    ),
    outputPath: path.resolve(
      cwd,
      cli.output || env.TAGGER_OUTPUT || "alt-tags.json",
    ),
    downloadDir: path.resolve(
      cwd,
      cli.downloadDir || env.TAGGER_DOWNLOADS || "downloads",
    ),
    delayMs:
      cli.delayMs ||
      (env.TAGGER_DELAY_MS ? parseInt(env.TAGGER_DELAY_MS, 10) : 1000),
    limit:
      cli.limit ||
      (env.TAGGER_LIMIT ? parseInt(env.TAGGER_LIMIT, 10) : undefined),
    openaiModel: env.TAGGER_MODEL || "gpt-4o-mini",
    cloudName: env.CLOUDINARY_CLOUDNAME || undefined,
    verbose: !!verbose,
  };
}

module.exports = { getConfig, parseArgs };

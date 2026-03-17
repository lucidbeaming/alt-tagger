"use strict";

const path = require("path");

function parseArgs(argv) {
  const args = argv !== undefined ? argv : process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) opts.input = args[++i];
    else if (args[i] === "--delay-ms" && args[i + 1])
      opts.delayMs = parseInt(args[++i], 10);
    else if (args[i] === "--limit" && args[i + 1])
      opts.limit = parseInt(args[++i], 10);
    else if (args[i] === "--mode" && args[i + 1]) opts.mode = args[++i];
    else if (args[i] === "--verbose" || args[i] === "-v") opts.verbose = true;
  }
  return opts;
}

function getPushAltConfig(argv) {
  const env = process.env;
  const cli = parseArgs(argv);
  const cwd = process.cwd();
  const verbose =
    cli.verbose ||
    (env.PUSHALT_VERBOSE !== undefined && env.PUSHALT_VERBOSE !== "");

  const cloudName =
    env.CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUDNAME || undefined;

  const mode = cli.mode || env.PUSHALT_MODE || "missing";
  if (mode !== "missing" && mode !== "all") {
    console.error(
      "[tagger] push: Invalid --mode value. Must be 'missing' or 'all'.",
    );
    process.exit(1);
  }

  return {
    inputPath: path.resolve(
      cwd,
      cli.input || env.PUSHALT_INPUT || "alt-tags.json",
    ),
    delayMs:
      cli.delayMs ||
      (env.PUSHALT_DELAY_MS ? parseInt(env.PUSHALT_DELAY_MS, 10) : 200),
    limit:
      cli.limit ||
      (env.PUSHALT_LIMIT ? parseInt(env.PUSHALT_LIMIT, 10) : undefined),
    cloudName,
    mode,
    verbose: !!verbose,
  };
}

module.exports = { getPushAltConfig, parseArgs };

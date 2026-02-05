#!/usr/bin/env node
"use strict";

require("./lib/loadEnv").loadEnv();

const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { getConfig } = require("./lib/config");
const { getPushAltConfig } = require("./lib/pushAltConfig");
const { retrieveResourceList } = require("./lib/retrieveList");
const {
  parseResources,
  parseCloudNameFromUrl,
} = require("./lib/parseResources");
const { buildUrlEntries } = require("./lib/buildUrls");
const { downloadAll } = require("./lib/download");
const { generateAltsForAll } = require("./lib/vision");
const { DEMO_CLOUD_NAME, DEMO_RESOURCE_TREE } = require("./lib/testFixture");

const TASKS = ["list", "download", "generate", "push", "test"];
const PREFIX_PUSH = "[tagger] push:";

function isPlaceholderOrError(altText) {
  if (typeof altText !== "string") return true;
  const t = altText.trim();
  return (
    t.startsWith("[error:") || t.startsWith("[download failed") || t === ""
  );
}

function getSubcommandArgv() {
  const arg2 = process.argv[2];
  if (TASKS.includes(arg2)) return { task: arg2, argv: process.argv.slice(3) };
  return { task: null, argv: process.argv.slice(2) };
}

function printUsage() {
  console.error(`Usage: node index.js <task> [options]
Tasks:
  list      Retrieve Cloudinary image resource list and write to input file (e.g. cloudinary-resources.json)
  download  Download images from resource list to downloads directory
  generate  Generate alt text for downloaded images via OpenAI Vision, write to output file (e.g. alt-tags.json)
  push      Update Cloudinary resources with alt text from output file
  test      Run full pipeline with Cloudinary demo cloud: fixture list, real download, simulated alt generation and push (no OpenAI or Cloudinary API)

Each task runs independently. Options (e.g. --input, --output, --limit, --verbose) apply per task.
Examples:
  node index.js list --output cloudinary-resources.json
  node index.js download --limit 10
  node index.js generate
  node index.js push
  node index.js test`);
}

async function runList(argv) {
  const config = getConfig(argv);
  const cloudName =
    config.cloudName ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUDNAME;
  if (!cloudName) {
    console.error(
      "[tagger] list: CLOUDINARY_CLOUD_NAME (or CLOUDINARY_CLOUDNAME) is required",
    );
    process.exit(1);
  }
  if (config.verbose) {
    console.error(
      "[tagger] list: Retrieving resource list for cloud",
      cloudName,
    );
  }
  const tree = await retrieveResourceList({
    cloudName,
    limit: config.limit,
    verbose: config.verbose,
  });
  const outputPath = config.inputPath;
  const outputDir = path.dirname(outputPath);
  if (outputDir && outputDir !== "." && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(tree, null, 2), "utf8");
  const count = countResources(tree);
  console.error("[tagger] list: Wrote", outputPath, "(", count, "resources )");
}

function countResources(node) {
  let n = 0;
  if (Array.isArray(node.resources)) n += node.resources.length;
  for (const key of Object.keys(node)) {
    if (key === "resources") continue;
    const val = node[key];
    if (val && typeof val === "object" && !Array.isArray(val))
      n += countResources(val);
  }
  return n;
}

async function runDownload(argv) {
  const config = getConfig(argv);
  if (config.verbose) {
    console.error("[tagger] download: Config:", {
      inputPath: config.inputPath,
      downloadDir: config.downloadDir,
      limit: config.limit,
      cloudName: config.cloudName ?? "(from input)",
    });
  }
  if (!fs.existsSync(config.inputPath)) {
    console.error("[tagger] download: Input file not found:", config.inputPath);
    console.error(
      "[tagger] download: Run 'list' first or provide an existing resource list file.",
    );
    process.exit(1);
  }
  let resources = parseResources(config.inputPath, { verbose: config.verbose });
  if (config.limit) {
    const before = resources.length;
    resources = resources.slice(0, config.limit);
    if (config.verbose)
      console.error(
        "[tagger] download: Limited to",
        config.limit,
        "(from",
        before,
        ")",
      );
  }
  const cloudName =
    config.cloudName ||
    (resources[0] && parseCloudNameFromUrl(resources[0].secure_url));
  if (!cloudName) {
    console.error(
      "[tagger] download: Could not determine cloud name. Set CLOUDINARY_CLOUD_NAME or use input with secure_url.",
    );
    process.exit(1);
  }
  const { entries } = buildUrlEntries(
    resources,
    cloudName,
    config.downloadDir,
    {
      verbose: config.verbose,
    },
  );
  if (!fs.existsSync(config.downloadDir)) {
    fs.mkdirSync(config.downloadDir, { recursive: true });
  }
  console.error(
    "[tagger] download: Downloading",
    entries.length,
    "images to",
    config.downloadDir,
  );
  const { succeeded, failed } = await downloadAll(entries, config.downloadDir, {
    verbose: config.verbose,
  });
  if (failed.length) {
    console.error("[tagger] download: Failed", failed.length);
    if (config.verbose)
      failed.forEach((f) => console.error("  ", f.public_id, f.error.message));
  }
  console.error("[tagger] download: Done. Downloaded", succeeded.length);
}

async function runGenerate(argv) {
  const config = getConfig(argv);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[tagger] generate: OPENAI_API_KEY is required");
    process.exit(1);
  }
  if (config.verbose) {
    console.error("[tagger] generate: Config:", {
      inputPath: config.inputPath,
      outputPath: config.outputPath,
      downloadDir: config.downloadDir,
      limit: config.limit,
      openaiModel: config.openaiModel,
    });
  }
  if (!fs.existsSync(config.inputPath)) {
    console.error("[tagger] generate: Input file not found:", config.inputPath);
    console.error(
      "[tagger] generate: Run 'list' first (or provide a resource list).",
    );
    process.exit(1);
  }
  let resources = parseResources(config.inputPath, { verbose: config.verbose });
  if (config.limit) {
    const before = resources.length;
    resources = resources.slice(0, config.limit);
    if (config.verbose)
      console.error(
        "[tagger] generate: Limited to",
        config.limit,
        "(from",
        before,
        ")",
      );
  }
  const cloudName =
    config.cloudName ||
    (resources[0] && parseCloudNameFromUrl(resources[0].secure_url));
  if (!cloudName) {
    console.error(
      "[tagger] generate: Could not determine cloud name. Set CLOUDINARY_CLOUD_NAME or use input with secure_url.",
    );
    process.exit(1);
  }
  const { entries, pathByPublicId } = buildUrlEntries(
    resources,
    cloudName,
    config.downloadDir,
    { verbose: config.verbose },
  );
  console.error(
    "[tagger] generate: Generating alt text for",
    entries.length,
    "images (rate-limited)...",
  );
  const alts = await generateAltsForAll(
    entries.map((e) => e.public_id),
    pathByPublicId,
    {
      apiKey,
      model: config.openaiModel,
      delayMs: config.delayMs,
      verbose: config.verbose,
    },
  );
  const outputDir = path.dirname(config.outputPath);
  if (outputDir && outputDir !== "." && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(config.outputPath, JSON.stringify(alts, null, 2), "utf8");
  console.error(
    "[tagger] generate: Wrote",
    config.outputPath,
    "(",
    Object.keys(alts).length,
    "entries )",
  );
}

async function pushAltsToCloudinary(alts, pushConfig) {
  const cloudName = pushConfig.cloudName;
  const apiKey =
    process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_APIKEY;
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_APISECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error(
      `${PREFIX_PUSH} Missing Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME (or CLOUDINARY_CLOUDNAME), CLOUDINARY_API_KEY (or CLOUDINARY_APIKEY), and CLOUDINARY_API_SECRET (or CLOUDINARY_APISECRET).`,
    );
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  const entries = Object.entries(alts);
  const list = pushConfig.limit ? entries.slice(0, pushConfig.limit) : entries;

  if (pushConfig.verbose) {
    console.error(
      `${PREFIX_PUSH} Pushing ${list.length} resources to Cloudinary...`,
    );
  }

  const succeeded = [];
  const failed = [];
  const skipped = [];

  for (let i = 0; i < list.length; i++) {
    const [publicId, altText] = list[i];

    if (isPlaceholderOrError(altText)) {
      skipped.push(publicId);
      if (pushConfig.verbose) {
        console.error(`${PREFIX_PUSH} Skip (placeholder/error):`, publicId);
      }
      continue;
    }

    if (pushConfig.verbose) {
      console.error(
        `${PREFIX_PUSH} Updating`,
        publicId,
        "->",
        altText.slice(0, 50) + (altText.length > 50 ? "..." : ""),
      );
    }

    try {
      await cloudinary.uploader.add_context({ alt: altText }, [publicId], {
        resource_type: "image",
        type: "upload",
      });
      succeeded.push(publicId);
    } catch (err) {
      failed.push({ public_id: publicId, error: err });
      console.error(
        `${PREFIX_PUSH} Error for`,
        publicId + ":",
        err.message || err,
      );
      if (pushConfig.verbose && err.error) {
        console.error(
          `${PREFIX_PUSH} API error:`,
          JSON.stringify(err.error, null, 2),
        );
      }
    }

    if (i < list.length - 1 && pushConfig.delayMs > 0) {
      await new Promise((r) => setTimeout(r, pushConfig.delayMs));
    }
  }

  console.error(
    `${PREFIX_PUSH} Done. Succeeded:`,
    succeeded.length,
    "Failed:",
    failed.length,
    "Skipped:",
    skipped.length,
  );
  if (pushConfig.verbose && (succeeded.length > 0 || failed.length > 0)) {
    if (succeeded.length > 0) {
      console.error(`${PREFIX_PUSH} Sample succeeded:`, succeeded.slice(0, 3));
    }
    if (failed.length > 0) {
      failed.forEach((f) =>
        console.error(`${PREFIX_PUSH} Failed`, f.public_id, f.error.message),
      );
    }
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

async function runPush(argv) {
  const pushConfig = getPushAltConfig(argv);
  if (pushConfig.verbose) {
    console.error("[tagger] push: Config:", {
      inputPath: pushConfig.inputPath,
      delayMs: pushConfig.delayMs,
      limit: pushConfig.limit,
      cloudName: pushConfig.cloudName ?? "(not set)",
    });
  }
  if (!fs.existsSync(pushConfig.inputPath)) {
    console.error("[tagger] push: Input file not found:", pushConfig.inputPath);
    console.error("[tagger] push: Run 'generate' first or set PUSHALT_INPUT.");
    process.exit(1);
  }
  let alts;
  try {
    alts = JSON.parse(fs.readFileSync(pushConfig.inputPath, "utf8"));
  } catch (err) {
    console.error(
      "[tagger] push: Invalid JSON in",
      pushConfig.inputPath,
      err.message,
    );
    process.exit(1);
  }
  if (typeof alts !== "object" || alts === null) {
    console.error(
      "[tagger] push: Expected an object (public_id -> alt text) in",
      pushConfig.inputPath,
    );
    process.exit(1);
  }
  await pushAltsToCloudinary(alts, pushConfig);
}

/**
 * Simulate alt generation without calling OpenAI. Returns one fake alt per public_id.
 * @param {string[]} publicIds
 * @returns {Promise<Record<string, string>>}
 */
async function simulateGenerateAlts(publicIds) {
  const result = {};
  for (const id of publicIds) {
    result[id] = `Simulated alt text for ${id}`;
  }
  return result;
}

/**
 * Simulate pushing alts to Cloudinary: log what would be updated, no API calls.
 * @param {Record<string, string>} alts
 * @param {{ verbose?: boolean }} options
 */
async function simulatePushAlts(alts, options = {}) {
  const verbose = options.verbose || false;
  const entries = Object.entries(alts);
  const skipped = [];
  const wouldUpdate = [];

  for (const [publicId, altText] of entries) {
    if (isPlaceholderOrError(altText)) {
      skipped.push(publicId);
      if (verbose) console.error(`${PREFIX_PUSH} [simulate] Skip:`, publicId);
      continue;
    }
    wouldUpdate.push({ publicId, altText });
    if (verbose) {
      console.error(
        `${PREFIX_PUSH} [simulate] Would update`,
        publicId,
        "->",
        altText.slice(0, 50) + (altText.length > 50 ? "..." : ""),
      );
    }
  }

  console.error(
    `${PREFIX_PUSH} [simulate] Done. Would update:`,
    wouldUpdate.length,
    "Skipped:",
    skipped.length,
  );
}

/**
 * Run full pipeline with demo cloud: fixture list, real downloads,
 * simulated generation (no OpenAI), simulated push (no Cloudinary API).
 */
async function runTest(argv) {
  const config = getConfig(argv);
  const cloudName = DEMO_CLOUD_NAME;
  const verbose = config.verbose;

  if (verbose) {
    console.error(
      "[tagger] test: Using demo cloud, simulated generation and push",
    );
  }

  // 1. List (simulated): write fixture to resource list file
  const outputDir = path.dirname(config.inputPath);
  if (outputDir && outputDir !== "." && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    config.inputPath,
    JSON.stringify(DEMO_RESOURCE_TREE, null, 2),
    "utf8",
  );
  const listCount = countResources(DEMO_RESOURCE_TREE);
  console.error(
    "[tagger] test: Wrote resource list (fixture) to",
    config.inputPath,
    "(",
    listCount,
    "resources )",
  );

  // 2. Download: real downloads from demo cloud public URLs (no API key)
  let resources = parseResources(config.inputPath, { verbose });
  const { entries } = buildUrlEntries(
    resources,
    cloudName,
    config.downloadDir,
    { verbose },
  );
  if (!fs.existsSync(config.downloadDir)) {
    fs.mkdirSync(config.downloadDir, { recursive: true });
  }
  console.error(
    "[tagger] test: Downloading",
    entries.length,
    "images from demo cloud...",
  );
  const { succeeded, failed } = await downloadAll(entries, config.downloadDir, {
    verbose,
  });
  if (failed.length) {
    console.error("[tagger] test: Download failed for", failed.length);
    if (verbose)
      failed.forEach((f) => console.error("  ", f.public_id, f.error.message));
  }
  console.error("[tagger] test: Downloaded", succeeded.length);

  // 3. Generate (simulated): no OpenAI
  const publicIds = entries.map((e) => e.public_id);
  console.error("[tagger] test: Simulating alt generation (no OpenAI)...");
  const alts = await simulateGenerateAlts(publicIds);
  const outDir = path.dirname(config.outputPath);
  if (outDir && outDir !== "." && !fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(config.outputPath, JSON.stringify(alts, null, 2), "utf8");
  console.error(
    "[tagger] test: Wrote",
    config.outputPath,
    "(",
    Object.keys(alts).length,
    "entries )",
  );

  // 4. Push (simulated): no Cloudinary API
  console.error("[tagger] test: Simulating push to Cloudinary (no API)...");
  await simulatePushAlts(alts, { verbose });

  console.error("[tagger] test: Done. No OpenAI or Cloudinary API was called.");
}

async function main() {
  const { task, argv } = getSubcommandArgv();

  if (!task) {
    printUsage();
    process.exit(1);
  }

  switch (task) {
    case "list":
      await runList(argv);
      break;
    case "download":
      await runDownload(argv);
      break;
    case "generate":
      await runGenerate(argv);
      break;
    case "push":
      await runPush(argv);
      break;
    case "test":
      await runTest(argv);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

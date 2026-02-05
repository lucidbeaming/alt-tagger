#!/usr/bin/env node
"use strict";

require("../lib/loadEnv").loadEnv();

const https = require("https");
const path = require("path");
const OpenAI = require("openai");

/** Required API keys for connection tests. Each entry is key or [alt1, alt2]. */
const REQUIRED_KEYS = [
  "OPENAI_API_KEY",
  ["CLOUDINARY_CLOUDNAME", "CLOUDINARY_CLOUD_NAME"],
  ["CLOUDINARY_APIKEY", "CLOUDINARY_API_KEY"],
  ["CLOUDINARY_APISECRET", "CLOUDINARY_API_SECRET"],
];

function checkRequiredEnv() {
  const missing = [];
  for (const keyOrAlts of REQUIRED_KEYS) {
    const keys = Array.isArray(keyOrAlts) ? keyOrAlts : [keyOrAlts];
    const value = keys.reduce((v, k) => v || process.env[k], undefined);
    if (value === undefined || value === null || String(value).trim() === "") {
      missing.push(keys.length > 1 ? keys.join(" or ") : keys[0]);
    }
  }
  if (missing.length === 0) return;
  console.error(
    "[test] ERROR: Missing required .env API keys for connection tests:",
  );
  missing.forEach((k) => console.error("[test]   -", k));
  console.error("[test] Copy .env-example to .env and set the values.");
  process.exit(1);
}

checkRequiredEnv();

const log = (msg, level = "info") => {
  const prefix = level === "error" ? "[test] ERROR:" : "[test]";
  const out = level === "error" ? console.error : console.log;
  out(prefix, msg);
};

const logIssue = (name, err) => {
  log(`${name}: ${err.message}`, "error");
  if (err.response) {
    try {
      log(`  Response status: ${err.response.status}`, "error");
      if (err.response.data)
        log(`  Response body: ${JSON.stringify(err.response.data)}`, "error");
    } catch {
      /* ignore */
    }
  }
  if (err.cause) log(`  Cause: ${err.cause.message || err.cause}`, "error");
};

async function testOpenAI() {
  log("Checking OpenAI API (OPENAI_API_KEY)...");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logIssue("OpenAI", new Error("OPENAI_API_KEY is not set"));
    return false;
  }
  if (apiKey.length < 20) {
    logIssue(
      "OpenAI",
      new Error("OPENAI_API_KEY looks too short; check it is set correctly"),
    );
    return false;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const list = await openai.models.list();
    const hasGpt =
      list.data &&
      list.data.some(
        (m) => m.id && (m.id.startsWith("gpt-4") || m.id.startsWith("gpt-3.5")),
      );
    log(
      `OpenAI: OK (models listed, vision-capable available: ${hasGpt !== false})`,
    );
    return true;
  } catch (err) {
    if (err.status === 401) {
      logIssue("OpenAI", new Error("Invalid API key or key revoked"));
    } else if (err.status === 429) {
      logIssue("OpenAI", new Error("Rate limited"));
    } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      logIssue(
        "OpenAI",
        new Error(`Network error: ${err.code}. Check internet / firewall.`),
      );
    } else {
      logIssue("OpenAI", err);
    }
    return false;
  }
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      const ok = res.statusCode >= 200 && res.statusCode < 400;
      resolve({ ok, statusCode: res.statusCode });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

async function testCloudinaryReachability() {
  log("Checking Cloudinary reachability (HTTPS to res.cloudinary.com)...");
  try {
    const url = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
    const { ok, statusCode } = await httpsGet(url);
    if (ok) {
      log("Cloudinary: OK (can reach res.cloudinary.com)");
      return true;
    }
    logIssue(
      "Cloudinary",
      new Error(`Unexpected status ${statusCode} from ${url}`),
    );
    return false;
  } catch (err) {
    logIssue(
      "Cloudinary",
      err.code ? new Error(`Network error: ${err.code}`) : err,
    );
    return false;
  }
}

async function testCloudinaryYourCloud() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const inputPath = process.env.TAGGER_INPUT
    ? path.resolve(process.cwd(), process.env.TAGGER_INPUT)
    : path.resolve(process.cwd(), "cloudinary-resources.json");

  let publicId = null;
  if (cloudName) {
    log(`Checking your Cloudinary cloud "${cloudName}" (sample URL fetch)...`);
    publicId = "sample";
  } else {
    const fs = require("fs");
    if (!fs.existsSync(inputPath)) {
      log(
        "Skipping cloud-specific check (no CLOUDINARY_CLOUD_NAME and no input file)",
      );
      return null;
    }
    log("Checking Cloudinary cloud from input file (first resource URL)...");
    try {
      const {
        parseResources,
        parseCloudNameFromUrl,
      } = require("../lib/parseResources");
      const resources = parseResources(inputPath);
      if (!resources.length) {
        log("No image resources in input file; skipping cloud URL check");
        return null;
      }
      const first = resources[0];
      publicId = first.public_id;
      const cloud = parseCloudNameFromUrl(first.secure_url);
      if (!cloud) {
        log("Could not parse cloud name from input; skipping cloud URL check");
        return null;
      }
      log(`Using cloud "${cloud}" and public_id "${publicId}" from input`);
    } catch (err) {
      logIssue("Cloudinary input", err);
      return null;
    }
  }

  try {
    const { buildImageUrl, createCloudinary } = require("../lib/buildUrls");
    const cloudNameForUrl =
      process.env.CLOUDINARY_CLOUD_NAME ||
      (() => {
        const {
          parseResources,
          parseCloudNameFromUrl,
        } = require("../lib/parseResources");
        const resources = parseResources(inputPath);
        return resources[0]
          ? parseCloudNameFromUrl(resources[0].secure_url)
          : null;
      })();
    if (!cloudNameForUrl) {
      log("Could not determine cloud name; skipping cloud URL check");
      return null;
    }
    const cld = createCloudinary(cloudNameForUrl);
    const url = buildImageUrl(cld, publicId);
    const { ok, statusCode } = await httpsGet(url);
    if (ok) {
      log(`Your cloud: OK (${statusCode}) ${url.slice(0, 60)}...`);
      return true;
    }
    if (statusCode === 404) {
      log(
        "Your cloud: Reachable; sample asset not found (404). Ensure input public_ids exist on this cloud.",
      );
      return true;
    }
    logIssue(
      "Your Cloudinary cloud",
      new Error(`URL returned ${statusCode}: ${url.slice(0, 80)}...`),
    );
    return false;
  } catch (err) {
    logIssue("Your Cloudinary cloud", err);
    return false;
  }
}

async function main() {
  console.log("");
  log("Testing API connections for tagger");
  log("---");

  const results = {
    openai: await testOpenAI(),
    cloudinary: await testCloudinaryReachability(),
    yourCloud: await testCloudinaryYourCloud(),
  };

  log("---");
  const openaiOk = results.openai;
  const cloudOk =
    results.cloudinary &&
    (results.yourCloud === null || results.yourCloud === true);
  if (openaiOk && cloudOk) {
    log("All checks passed. You can run: node index.js");
    process.exit(0);
  }
  if (!openaiOk) {
    log("Fix OpenAI (OPENAI_API_KEY) to run alt generation.", "error");
  }
  if (!results.cloudinary) {
    log("Fix network/Cloudinary reachability if downloads fail.", "error");
  }
  if (results.yourCloud === false) {
    log(
      "Check CLOUDINARY_CLOUD_NAME or input file so image URLs use the correct cloud.",
      "error",
    );
  }
  process.exit(1);
}

main().catch((err) => {
  logIssue("Script", err);
  process.exit(1);
});

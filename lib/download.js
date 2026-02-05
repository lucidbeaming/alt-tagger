"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const CONCURRENCY = 5;

function downloadOne(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(
      url,
      { headers: { "User-Agent": "tagger/1.0" } },
      (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      },
    );
    req.on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * Run up to `concurrency` promises at a time.
 */
async function runWithConcurrency(items, concurrency, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        const value = await fn(items[i]);
        results[i] = { ok: true, value };
      } catch (err) {
        results[i] = { ok: false, error: err };
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Download all images to downloadDir. Only runs when called from the full script.
 * @param {{ public_id: string, downloadUrl: string, filename: string }[]} entries
 * @param {string} downloadDir
 * @param {{ verbose?: boolean, concurrency?: number }} options
 * @returns {Promise<{ succeeded: string[], failed: { public_id: string, error: Error }[] }>}
 */
async function downloadAll(entries, downloadDir, options = {}) {
  const verbose = options.verbose || false;
  const concurrency = options.concurrency ?? CONCURRENCY;

  if (verbose) {
    console.error("[download] Concurrency:", concurrency);
    console.error("[download] Target dir:", downloadDir);
  }

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
    if (verbose) console.error("[download] Created directory:", downloadDir);
  }

  const tasks = entries.map((e) => ({
    public_id: e.public_id,
    url: e.downloadUrl,
    destPath: path.join(downloadDir, e.filename),
  }));

  if (verbose) {
    console.error("[download] Starting", tasks.length, "downloads");
  }

  const results = await runWithConcurrency(tasks, concurrency, async (t) => {
    if (verbose) {
      console.error(
        "[download] Fetching",
        t.public_id,
        "->",
        path.basename(t.destPath),
      );
    }
    await downloadOne(t.url, t.destPath);
    if (verbose) {
      console.error("[download] OK", t.public_id);
    }
    return t.public_id;
  });

  const succeeded = [];
  const failed = [];
  tasks.forEach((t, i) => {
    const r = results[i];
    if (r.ok) succeeded.push(r.value);
    else {
      failed.push({ public_id: t.public_id, error: r.error });
      if (verbose) {
        console.error("[download] FAILED", t.public_id, r.error.message);
      }
    }
  });

  console.error(
    "[download] Done. Succeeded:",
    succeeded.length,
    "Failed:",
    failed.length,
  );
  if (verbose && failed.length) {
    failed.forEach((f) =>
      console.error("[download]   ", f.public_id, ":", f.error.message),
    );
  }

  return { succeeded, failed };
}

module.exports = { downloadOne, downloadAll, runWithConcurrency };

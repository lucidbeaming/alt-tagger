"use strict";

const fs = require("fs");

/**
 * Recursively collect image resources from a section and any nested subfolders.
 * @param {object} section - Folder section (may have resources and/or nested subfolder objects)
 * @param {{ public_id: string, secure_url: string }[]} list - Accumulator
 */
function collectFromSection(section, list) {
  if (!section || typeof section !== "object") return;
  if (Array.isArray(section.resources)) {
    for (const r of section.resources) {
      if (r.resource_type && r.resource_type !== "image") continue;
      if (!r.public_id || !r.secure_url) continue;
      list.push({ public_id: r.public_id, secure_url: r.secure_url });
    }
  }
  for (const key of Object.keys(section)) {
    if (key === "resources") continue;
    const val = section[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      collectFromSection(val, list);
    }
  }
}

/**
 * Parse Cloudinary resources JSON and return a flat list of image resources.
 * Input structure: { [folder]: { resources: [...], [subfolder]?: { resources: [...], ... } } }
 * Supports nested subfolders at any depth.
 * @param {string} inputPath - Path to the JSON file
 * @param {{ verbose?: boolean }} options
 * @returns {{ public_id: string, secure_url: string }[]}
 */
function parseResources(inputPath, options = {}) {
  const verbose = options.verbose || false;

  if (verbose) {
    console.error("[parse] Reading input:", inputPath);
  }
  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);

  if (typeof data !== "object" || data === null) {
    throw new Error("Input JSON must be an object");
  }

  const folderKeys = Object.keys(data);
  if (verbose) {
    console.error(
      "[parse] Top-level keys (folders):",
      folderKeys.length,
      folderKeys.slice(0, 5).join(", ") + (folderKeys.length > 5 ? "..." : ""),
    );
  }

  const list = [];
  for (const key of folderKeys) {
    collectFromSection(data[key], list);
  }

  if (verbose) {
    console.error("[parse] Total image resources:", list.length);
    if (list.length) {
      console.error("[parse] First:", list[0].public_id);
      console.error("[parse] Last:", list[list.length - 1].public_id);
    }
  }

  return list;
}

/**
 * Parse cloud name from a Cloudinary secure_url (e.g. https://res.cloudinary.com/<cloudName>/...).
 * @param {string} secureUrl
 * @returns {string|null}
 */
function parseCloudNameFromUrl(secureUrl) {
  const m = secureUrl.match(/res\.cloudinary\.com\/([^/]+)\//);
  return m ? m[1] : null;
}

module.exports = { parseResources, parseCloudNameFromUrl };

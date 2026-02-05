"use strict";

const crypto = require("crypto");
const path = require("path");
const { Cloudinary } = require("@cloudinary/url-gen");
const { limitFit } = require("@cloudinary/url-gen/actions/resize");

/**
 * Build Cloudinary instance with secure URLs.
 * @param {string} cloudName
 * @returns {import('@cloudinary/url-gen').Cloudinary}
 */
function createCloudinary(cloudName) {
  return new Cloudinary({
    cloud: { cloudName },
    url: { secure: true },
  });
}

/**
 * Build download URL for one image: medium size, JPEG, eco quality.
 * @param {import('@cloudinary/url-gen').Cloudinary} cld
 * @param {string} publicId
 * @returns {string}
 */
function buildImageUrl(cld, publicId) {
  const img = cld
    .image(publicId)
    .resize(limitFit(500))
    .format("jpg")
    .quality("auto:eco");
  return img.toURL();
}

/**
 * MD5 hash of public_id for stable filename.
 * @param {string} publicId
 * @returns {string}
 */
function md5Filename(publicId) {
  return crypto.createHash("md5").update(publicId).digest("hex") + ".jpg";
}

/**
 * Build list of { public_id, downloadUrl, filename } and map public_id -> local path.
 * @param {{ public_id: string, secure_url: string }[]} resources
 * @param {string} cloudName
 * @param {string} downloadDir
 * @param {{ verbose?: boolean }} options
 * @returns {{ entries: { public_id: string, downloadUrl: string, filename: string }[], pathByPublicId: Map<string, string> }}
 */
function buildUrlEntries(resources, cloudName, downloadDir, options = {}) {
  const verbose = options.verbose || false;

  if (verbose) {
    console.error("[buildUrls] Cloud name:", cloudName);
    console.error("[buildUrls] Download dir:", downloadDir);
    console.error(
      "[buildUrls] Building URLs for",
      resources.length,
      "resources",
    );
  }

  const cld = createCloudinary(cloudName);
  const pathByPublicId = new Map();
  const entries = resources.map((r) => {
    const filename = md5Filename(r.public_id);
    const localPath = path.join(downloadDir, filename);
    pathByPublicId.set(r.public_id, localPath);
    return {
      public_id: r.public_id,
      downloadUrl: buildImageUrl(cld, r.public_id),
      filename,
    };
  });

  if (verbose && entries.length) {
    console.error(
      "[buildUrls] Sample URL for",
      entries[0].public_id + ":",
      entries[0].downloadUrl,
    );
    console.error("[buildUrls] Sample filename:", entries[0].filename);
  }

  return { entries, pathByPublicId };
}

module.exports = {
  createCloudinary,
  buildImageUrl,
  md5Filename,
  buildUrlEntries,
};

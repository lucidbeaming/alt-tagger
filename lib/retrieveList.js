"use strict";

const cloudinary = require("cloudinary").v2;

/**
 * Group resources by folder path so the result matches the structure
 * expected by parseResources: { [folder]: { resources: [...], [subfolder]: { resources: [...] } } }
 * @param {{ public_id: string, secure_url: string }[]} resources
 * @returns {object}
 */
function groupByFolder(resources) {
  const root = {};
  for (const r of resources) {
    const parts = r.public_id.split("/");
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      if (!current[segment]) current[segment] = { resources: [] };
      current = current[segment];
    }
    if (!current.resources) current.resources = [];
    current.resources.push({
      public_id: r.public_id,
      secure_url: r.secure_url,
      resource_type: r.resource_type || "image",
    });
  }
  return root;
}

/**
 * Retrieve all image resources from Cloudinary (paginated), group by folder,
 * and return the structure suitable for writing to cloudinary-resources.json.
 * @param {{ cloudName: string, limit?: number, verbose?: boolean }} options
 * @returns {Promise<object>} Folder-grouped resource tree
 */
async function retrieveResourceList(options = {}) {
  const { cloudName, limit, verbose = false } = options;
  const apiKey =
    process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_APIKEY;
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_APISECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Missing Cloudinary credentials. Set CLOUDINARY_CLOUD_NAME (or CLOUDINARY_CLOUDNAME), CLOUDINARY_API_KEY (or CLOUDINARY_APIKEY), and CLOUDINARY_API_SECRET (or CLOUDINARY_APISECRET).",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  const all = [];
  let res = await cloudinary.api.resources({
    resource_type: "image",
    type: "upload",
    max_results: 500,
  });

  const push = (list) => {
    const max = limit ? limit - all.length : list.length;
    let n = 0;
    for (const r of list) {
      if (limit && n >= max) return true;
      if (r.resource_type && r.resource_type !== "image") continue;
      if (!r.public_id || !r.secure_url) continue;
      all.push({
        public_id: r.public_id,
        secure_url: r.secure_url,
        resource_type: r.resource_type || "image",
      });
      n++;
    }
    return !!limit && all.length >= limit;
  };

  if (push(res.resources || [])) {
    if (verbose) console.error("[retrieveList] Limited to", limit, "resources");
    return groupByFolder(all);
  }

  while (res.next_cursor) {
    res = await cloudinary.api.resources({
      resource_type: "image",
      type: "upload",
      max_results: 500,
      next_cursor: res.next_cursor,
    });
    if (push(res.resources || [])) break;
  }

  if (verbose) {
    console.error("[retrieveList] Retrieved", all.length, "image resources");
  }
  return groupByFolder(all);
}

module.exports = { retrieveResourceList, groupByFolder };

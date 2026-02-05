"use strict";

/**
 * Cloudinary demo cloud name (public, no API key needed for reading URLs).
 * https://res.cloudinary.com/demo/image/upload/...
 */
const DEMO_CLOUD_NAME = "demo";

/**
 * Small fixture of demo cloud image resources. Matches the structure
 * expected by parseResources: { [folder]: { resources: [...], [subfolder]: {...} } }
 * No Cloudinary API call required.
 */
const DEMO_RESOURCE_TREE = {
  "": {
    resources: [
      {
        public_id: "sample",
        secure_url: "https://res.cloudinary.com/demo/image/upload/sample",
        resource_type: "image",
      },
    ],
  },
  docs: {
    resources: [
      {
        public_id: "docs/sample",
        secure_url:
          "https://res.cloudinary.com/demo/image/upload/docs/sample",
        resource_type: "image",
      },
    ],
  },
};

module.exports = { DEMO_CLOUD_NAME, DEMO_RESOURCE_TREE };

"use strict";

const fs = require("fs");
const OpenAI = require("openai");

const ALT_PROMPT =
  "Describe this image in one short sentence suitable for an HTML alt attribute. Be concise and descriptive. Reply with only the alt text, no quotes or explanation. DO not return double quotes or backticks or single quotes.";

/**
 * @param {string} apiKey
 * @param {string} model
 * @param {number} delayMs
 * @param {{ verbose?: boolean }} options
 * @returns {(publicId: string, imagePath: string) => Promise<string>}
 */
function createAltGenerator(apiKey, model, delayMs, options = {}) {
  const verbose = options.verbose || false;
  const openai = new OpenAI({ apiKey });

  return async function generateAlt(publicId, imagePath) {
    if (verbose) {
      console.error("[vision] Request for", publicId);
    }

    const buffer = fs.readFileSync(imagePath);
    const base64 = buffer.toString("base64");
    if (verbose) {
      console.error(
        "[vision] Image size (bytes):",
        buffer.length,
        "base64 length:",
        base64.length,
      );
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ALT_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 150,
    });

    if (verbose) {
      const usage = response.usage;
      console.error("[vision] API response id:", response.id);
      if (usage) {
        console.error(
          "[vision] Usage - prompt_tokens:",
          usage.prompt_tokens,
          "completion_tokens:",
          usage.completion_tokens,
          "total_tokens:",
          usage.total_tokens,
        );
      }
      const firstChoice = response.choices && response.choices[0];
      if (firstChoice) {
        console.error("[vision] Finish reason:", firstChoice.finish_reason);
        const rawContent = firstChoice.message && firstChoice.message.content;
        console.error(
          "[vision] Raw content:",
          JSON.stringify(rawContent !== undefined ? rawContent : ""),
        );
      }
    }

    const choice = response.choices && response.choices[0];
    const content = choice && choice.message && choice.message.content;
    const trimmed = typeof content === "string" ? content.trim() : "";
    if (trimmed) {
      if (verbose) {
        console.error("[vision] Alt for", publicId + ":", trimmed);
      }
      return trimmed;
    }
    throw new Error("Empty response from OpenAI");
  };
}

/**
 * Generate alt text for each image with rate limiting. On failure, store placeholder and continue.
 * @param {string[]} publicIds
 * @param {Map<string, string>} pathByPublicId
 * @param {{ apiKey: string, model: string, delayMs: number, verbose?: boolean }} options
 * @returns {Promise<Record<string, string>>}
 */
async function generateAltsForAll(publicIds, pathByPublicId, options) {
  const verbose = options.verbose || false;
  const generate = createAltGenerator(
    options.apiKey,
    options.model,
    options.delayMs,
    { verbose },
  );

  if (verbose) {
    console.error("[vision] Model:", options.model);
    console.error("[vision] Delay between requests (ms):", options.delayMs);
    console.error("[vision] Processing", publicIds.length, "images");
  }

  const result = {};

  for (let i = 0; i < publicIds.length; i++) {
    const publicId = publicIds[i];
    const imagePath = pathByPublicId.get(publicId);
    if (!imagePath || !fs.existsSync(imagePath)) {
      result[publicId] = "[download failed or missing]";
      if (verbose) {
        console.error("[vision] Skip (no file):", publicId);
      }
      continue;
    }
    try {
      const alt = await generate(publicId, imagePath);
      result[publicId] = alt;
    } catch (err) {
      result[publicId] = `[error: ${err.message || "unknown"}]`;
      console.error("[vision] Error for", publicId + ":", err.message);
      if (verbose && err.response) {
        console.error(
          "[vision] API error response:",
          JSON.stringify(err.response, null, 2),
        );
      }
    }
    if (i < publicIds.length - 1 && options.delayMs > 0) {
      await new Promise((r) => setTimeout(r, options.delayMs));
    }
  }

  if (verbose) {
    const ok = Object.values(result).filter((v) => !v.startsWith("[")).length;
    console.error(
      "[vision] Done. Generated:",
      ok,
      "Placeholders/errors:",
      publicIds.length - ok,
    );
  }

  return result;
}

module.exports = { createAltGenerator, generateAltsForAll, ALT_PROMPT };

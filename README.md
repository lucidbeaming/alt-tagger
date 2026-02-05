# alt-tagger

Generate and push HTML alt text for Cloudinary images using OpenAI Vision. Fetches your image resource list from Cloudinary, downloads images, generates concise alt text with GPT, and writes alt context back to Cloudinary—all in discrete steps you can run independently.

## Features

- **List** – Retrieve image resources from your Cloudinary cloud via the Admin API and save a resource list (folder structure preserved).
- **Download** – Download images from that list to a local directory (optimized URLs for fast, small files).
- **Generate** – Produce one short alt sentence per image using OpenAI Vision (rate-limited, with placeholders on failure).
- **Push** – Update Cloudinary assets with the generated alt text via the Upload API (add context).
- **Test** – Run a full pipeline against the Cloudinary demo cloud with simulated generation and push (no API keys required).

Each step is a separate task so you can run only what you need, re-run steps, or plug in your own resource list or alt file.

## Requirements

- **Node.js** 18+ (for native `fetch` if used; otherwise 16+)
- **OpenAI API key** (for the `generate` task)
- **Cloudinary account** (for `list` and `push`; cloud name can be inferred from resource list URLs for `download`/`generate`)

## Installation

```bash
git clone <repo-url>
cd alt-tagger
npm install
```

## Configuration

Copy the example env file and set your keys and options:

```bash
cp .env-example .env
```

Edit `.env` (never commit it; it’s in `.gitignore`).

### Environment variables

| Variable                                          | Required              | Description                                      |
| ------------------------------------------------- | --------------------- | ------------------------------------------------ |
| `OPENAI_API_KEY`                                  | For `generate`        | OpenAI API key (used for Vision/alt generation). |
| `CLOUDINARY_CLOUDNAME` or `CLOUDINARY_CLOUD_NAME` | For `list` and `push` | Your Cloudinary cloud name.                      |
| `CLOUDINARY_APIKEY` or `CLOUDINARY_API_KEY`       | For `list` and `push` | Cloudinary API key.                              |
| `CLOUDINARY_APISECRET` or `CLOUDINARY_API_SECRET` | For `list` and `push` | Cloudinary API secret.                           |

Optional (defaults shown):

| Variable           | Default                     | Description                                                                   |
| ------------------ | --------------------------- | ----------------------------------------------------------------------------- |
| `TAGGER_INPUT`     | `cloudinary-resources.json` | Path to the resource list file (read for download/generate; written by list). |
| `TAGGER_OUTPUT`    | `alt-tags.json`             | Path to the generated alt text file (public_id → alt string).                 |
| `TAGGER_DOWNLOADS` | `downloads`                 | Directory where images are downloaded.                                        |
| `TAGGER_DELAY_MS`  | `1000`                      | Delay in ms between OpenAI requests (generate).                               |
| `TAGGER_LIMIT`     | (none)                      | Max number of resources to process (list/download/generate).                  |
| `TAGGER_MODEL`     | `gpt-4o-mini`               | OpenAI model for Vision (e.g. `gpt-4o-mini`, `gpt-4o`).                       |
| `TAGGER_VERBOSE`   | (unset)                     | Set to `1` (or use `--verbose`) for verbose logging.                          |
| `PUSHALT_INPUT`    | `alt-tags.json`             | Alt file to read for the `push` task.                                         |
| `PUSHALT_DELAY_MS` | `200`                       | Delay in ms between Cloudinary context updates.                               |
| `PUSHALT_LIMIT`    | (none)                      | Max number of entries to push.                                                |
| `PUSHALT_VERBOSE`  | (unset)                     | Verbose logging for push.                                                     |

Any option can be overridden on the command line (e.g. `--input`, `--output`, `--limit`, `--verbose`).

## Usage

All commands use a **task** as the first argument. Options follow the task.

```bash
node index.js <task> [options]
```

### Tasks

| Task       | Description                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list`     | Call Cloudinary Admin API to list image resources, group by folder, and write the result to the resource list file (e.g. `cloudinary-resources.json`). Requires Cloudinary credentials and cloud name. |
| `download` | Read the resource list file, build image URLs, and download images into the downloads directory. Cloud name can come from the list file or env.                                                        |
| `generate` | Read the resource list and local image paths, call OpenAI Vision for each image, and write public_id → alt text to the output file (e.g. `alt-tags.json`). Requires `OPENAI_API_KEY`.                  |
| `push`     | Read the alt file and call Cloudinary’s add-context API to set alt text on each asset. Requires Cloudinary credentials.                                                                                |
| `test`     | Run list (fixture) → download (real) → generate (simulated) → push (simulated) using the Cloudinary **demo** cloud. No OpenAI or Cloudinary API keys needed.                                           |

### Examples

```bash
# Run the full pipeline (each step separately)
node index.js list
node index.js download --limit 50
node index.js generate
node index.js push

# Or use npm script for push only
npm run push-alt

# Test without any API keys (demo cloud, simulated generation and push)
node index.js test
node index.js test --verbose

# Override paths and limits
node index.js list --output my-resources.json
node index.js download --input my-resources.json --limit 10
node index.js generate --input my-resources.json --output my-alts.json
node index.js push --input my-alts.json --limit 5

# Verbose logging
node index.js download -v
```

### Checking API connectivity

```bash
npm run test:connections
```

This script checks that `OPENAI_API_KEY` works and that Cloudinary (and optionally your cloud) is reachable.

## File formats

- **Resource list** (e.g. `cloudinary-resources.json`): JSON object keyed by folder; each value can have a `resources` array and/or nested folders. Each resource has at least `public_id` and `secure_url`. The `list` task writes this format; `download` and `generate` read it.
- **Alt file** (e.g. `alt-tags.json`): JSON object mapping `public_id` (string) to alt text (string). The `generate` task writes it; `push` reads it. Entries like `[error: ...]` or `[download failed or missing]` are skipped on push.

## Vendor API documentation

- **OpenAI**
  - [API keys](https://platform.openai.com/api-keys)
  - [Chat Completions (Vision)](https://platform.openai.com/docs/guides/vision)
  - [Node.js / OpenAI SDK](https://github.com/openai/openai-node)
- **Cloudinary**
  - [Dashboard (cloud name, API key, secret)](https://cloudinary.com/console)
  - [Admin API – List resources](https://cloudinary.com/documentation/admin_api#get_resources)
  - [Upload API – Add context (metadata)](https://cloudinary.com/documentation/image_upload_api_reference#add_context)
  - [Node.js SDK](https://cloudinary.com/documentation/node_integration)
  - [URL generation (Node)](https://cloudinary.com/documentation/node_asset_administration)

## License

GNU General Public License v3.0 (GPL-3.0). See [LICENSE](LICENSE) for the full text.

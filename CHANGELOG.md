# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- openai 7, dotenv 18, cloudinary 2.11, ESLint 10, Prettier 3.10 (#2)
- Requires Node 22 or newer (`engines.node`, README), as openai 7 does (#2)
- Source formatted with Prettier (#2)

### Fixed

- `@eslint/js` declared as a dev dependency; `npm run lint` failed without it on ESLint 10 (#2)

### Security

- Resolved 5 high and 2 moderate npm advisories (#2)

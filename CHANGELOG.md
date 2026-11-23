# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.1.0] - 2026-11-23

Current dependencies (openai 7, cloudinary 2.11, ESLint 10; npm audit: 0), with Node 22+ now required. Test runs no longer dirty the working tree, and the README adds guidance on writing good alt text.

### Added

- README: sample output, alt-text quality guidance, `push --mode` / `PUSHALT_MODE`, related projects (#9)

### Changed

- Relicensed from GPL-3.0 to MIT; earlier releases keep GPL-3.0 (#4)
- Package metadata: `repository`, `bugs` and `homepage` in `package.json` (#4)
- openai 7, dotenv 18, cloudinary 2.11, ESLint 10, Prettier 3.10 (#2)
- Requires Node 22 or newer (`engines.node`, README), as openai 7 does (#2)
- Source formatted with Prettier (#2)

### Fixed

- `npm run test` no longer dirties the working tree: pipeline output (`alt-tags.json`, `cloudinary-resources.json`, `downloads/`) is ignored and untracked (#7)
- `@eslint/js` declared as a dev dependency; `npm run lint` failed without it on ESLint 10 (#2)

### Security

- Resolved 5 high and 2 moderate npm advisories (#2)

[Unreleased]: https://github.com/lucidbeaming/alt-tagger/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/lucidbeaming/alt-tagger/releases/tag/v1.1.0

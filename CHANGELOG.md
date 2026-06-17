# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-06-18

### Added

- **Language identification:** `db.yml`, `db.yaml` (by filename) and `*.yrest.yml`, `*.yrest.yaml` (by extension) are automatically recognized as `yrest` language
- **Syntax highlighting:** reserved keys (`_rel`, `_routes`, `_schema`, `_type`, `_target`, `_foreignKey`, `_car-direct`, `_car-inverse`, `_nested`, `_through`, `_primaryKey`), relation types (`many2one`, `one2one`, `many2many`), DSL strings with type alias, target, FK, cardinality and `+nested` flag, template variables (`{{params.id}}`, `{{now}}`, `{{uuid}}`), and path parameters (`:id`) in `_routes` paths
- **Grammar injections:** yrest reserved keys, relation types and cardinalities are also highlighted in plain `.yaml` files and inside TypeScript/JavaScript files
- **Diagnostics:** validates on every open and change event — YAML parse errors (with exact position), `_rel` entity names must match a root collection, relation targets must match a root collection, `_type` must be a valid relation type, `_car-direct`/`_car-inverse` must use accepted cardinality notation, DSL strings validated against the full compact format
- **`language-configuration.json`:** comment character `#`, bracket pairs and auto-closing pairs for `{}`, `[]`, `()`, `""`, `''`
- **CI pipeline:** compile + lint + VSIX package on every push to `main` and every PR
- **Publish pipeline:** automatic publish to VS Code Marketplace on tag push (`v0.x.y` → pre-release, `v1.x.y` → stable); creates a GitHub Release with notes extracted from `CHANGELOG.md`

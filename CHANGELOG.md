# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.1] — 2026-06-19

### Added

- **`_routes` diagnostics:** validates that route entries use the `_`-prefixed key convention — flags bare keys like `method`, `path`, `response`, `when`, `status`, `body`, etc. and suggests the correct form (`_method`, `_path`, `_response`, `_when`, `_status`, `_body`…) at three levels: route entry, `_response`/`_otherwise` block, and `_scenarios` entries
- **Unit tests:** 14 new tests for `validateRoutes` covering all bare-key cases (45 total)

---

## [0.2.0] — 2026-06-19

### Added

- **Hover documentation:** inline markdown docs appear when hovering any yrest reserved key, relation type, cardinality notation or `+nested` flag — covering `_rel`, `_routes`, `_schema` and all nested keys (`_type`, `_target`, `_foreignKey`, `_otherKey`, `_primaryKey`, `_through`, `_car-direct`, `_car-inverse`, `_nested`, `_method`, `_path`, `_handler`, `_response`, `_scenarios`, `_otherwise`, `_delay`, `_error`, `_errorBody`, `_status`, `_body`, `_headers`, `_when`) plus all relation type aliases (`many2one`, `m2o`, `one2one`, `o2o`, `many2many`, `m2m`) and cardinalities (`1..1`, `0..1`, `1..n`, `0..n`). Hover also works inside TypeScript/JavaScript tagged template literals (`yrest\`...\``)
- **Autocomplete provider:** context-aware completions for 10 distinct scenarios — `_type` values (relation types + aliases), `_target`/`_through` values (collection names from the document), `_car-direct`/`_car-inverse` values (cardinality notation), `_nested` values (`true`/`false`), `_method` values (HTTP methods), verbose relation keys inside `_rel` object blocks, shorthand relation target values, `_routes` entry keys, `_response`/`_otherwise` block keys, and `_scenarios` entry keys
- **Grammar — `_routes` keys:** added 13 new reserved key highlights in both `yrest.tmLanguage.json` and `yrest-yaml-injection.json`: `_method`, `_path`, `_handler`, `_delay`, `_error`, `_errorBody`, `_response`, `_otherwise`, `_scenarios`, `_when`, `_status`, `_body`, `_headers`
- **Unit tests:** 31 tests covering pure validation logic and shared constants

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

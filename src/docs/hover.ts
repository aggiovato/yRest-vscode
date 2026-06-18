/**
 * Hover provider for yrest YAML files.
 *
 * Shows inline documentation when the cursor rests on a yrest reserved key,
 * relation type, cardinality notation, or DSL alias.
 *
 * @module hover
 */

import * as vscode from "vscode";

// ─── Token regex ──────────────────────────────────────────────────────────────

/**
 * Matches any token that may have hover documentation:
 * - Reserved keys: `_rel`, `_car-direct`, `_foreignKey`, etc.
 * - Relation types and aliases: `many2one`, `m2o`, `+nested`
 * - Cardinality notation: `1..1`, `0..n`
 */
const TOKEN_REGEX = /[+_]?[a-zA-Z][a-zA-Z0-9_-]*|[01]\.\.[1n]/;

// ─── Hover content ────────────────────────────────────────────────────────────

const DOCS: Record<string, string> = {
  // ── _routes entry keys ────────────────────────────────────────────────────
  _method: [
    "## `_method`",
    "HTTP method for this route (case-insensitive).",
    "\n",
    "Accepted values: `GET` `POST` `PUT` `PATCH` `DELETE` `HEAD` `OPTIONS`",
    "\n",
    "```yaml",
    "_routes:",
    "  - _method: POST",
    "    _path: /auth/login",
    "```",
  ].join("\n"),

  _path: [
    "## `_path`",
    "URL path for this route. Must start with `/`.",
    "\n",
    "Supports Fastify path parameters (`:id`, `:slug`).",
    "Respects the `--base` prefix when set.",
    "\n",
    "```yaml",
    "_path: /orders/:id/receipt",
    "```",
  ].join("\n"),

  _handler: [
    "## `_handler`",
    "Name of an exported function in `yrest.handlers.js`.",
    "\n",
    "Takes priority over `_scenarios` and `_response`.",
    "Falls back to `_response` if the function is not found or throws.",
    "\n",
    "```yaml",
    "_handler: login",
    "```",
  ].join("\n"),

  _response: [
    "## `_response`",
    "Static response block. Final fallback when no handler, scenario or `_otherwise` applies.",
    "\n",
    "Supports `{{}}` template variables in `_body`.",
    "\n",
    "```yaml",
    "_response:",
    "  _status: 200",
    "  _body:",
    '    token: "{{uuid}}"',
    '    issuedAt: "{{now}}"',
    "```",
  ].join("\n"),

  _scenarios: [
    "## `_scenarios`",
    "List of conditional response variants. Evaluated in order — first match wins.",
    "\n",
    "Each entry has a `_when` condition and a `_response`.",
    "When no scenario matches, falls back to `_otherwise` or `_response`.",
    "\n",
    "```yaml",
    "_scenarios:",
    "  - _when:",
    "      body.role: admin",
    "    _response:",
    "      _status: 200",
    "      _body: { admin: true }",
    "```",
  ].join("\n"),

  _otherwise: [
    "## `_otherwise`",
    "Explicit fallback response when `_scenarios` are defined but none matched.",
    "\n",
    "Takes priority over `_response` when present.",
    "Supports `{{}}` template variables.",
    "\n",
    "```yaml",
    "_otherwise:",
    "  _status: 401",
    "  _body: { error: Invalid credentials }",
    "```",
  ].join("\n"),

  _delay: [
    "## `_delay`",
    "Simulated latency in milliseconds, applied before any response is sent.",
    "\n",
    "Overrides the global `--delay` option for this route.",
    "Works with handlers, scenarios and static responses.",
    "\n",
    "```yaml",
    "_delay: 300",
    "```",
  ].join("\n"),

  _error: [
    "## `_error`",
    "Forces this route to always return the given HTTP status as an error,",
    "bypassing handlers, scenarios and the static response.",
    "\n",
    "Applied after `_delay`, so slow-error scenarios still work.",
    "\n",
    "```yaml",
    "_error: 503",
    "_errorBody: { message: Service unavailable }",
    "```",
  ].join("\n"),

  _errorBody: [
    "## `_errorBody`",
    "Optional body returned alongside `_error`.",
    "\n",
    'Defaults to `{ error: "Forced error <status>" }` when omitted.',
    "\n",
    "```yaml",
    "_error: 503",
    "_errorBody: { message: Service unavailable }",
    "```",
  ].join("\n"),

  // ── _response / _otherwise block keys ─────────────────────────────────────
  _status: [
    "## `_status`",
    "HTTP status code for this response block.",
    "\n",
    "Defaults to `200` when omitted.",
    "\n",
    "```yaml",
    "_response:",
    "  _status: 201",
    "  _body: { id: 42 }",
    "```",
  ].join("\n"),

  _body: [
    "## `_body`",
    "Response body — any YAML value (object, array, string, number…).",
    "\n",
    "Supports `{{}}` template variables resolved at request time:",
    "`{{params.id}}`, `{{query.x}}`, `{{body}}`, `{{now}}`, `{{uuid}}`",
    "\n",
    "```yaml",
    "_body:",
    '  orderId: "{{params.id}}"',
    '  issuedAt: "{{now}}"',
    "```",
  ].join("\n"),

  _headers: [
    "## `_headers`",
    "Additional response headers set alongside `Content-Type`.",
    "\n",
    "```yaml",
    "_headers:",
    "  Cache-Control: no-store",
    '  X-Request-Id: "{{uuid}}"',
    "```",
  ].join("\n"),

  // ── _scenarios entry keys ──────────────────────────────────────────────────
  _when: [
    "## `_when`",
    "Condition for a scenario entry. Evaluated against the incoming request.",
    "\n",
    "**Object form** — all entries must match (AND):",
    "```yaml",
    "_when:",
    "  body.email: ana@test.com",
    "  body.role: admin",
    "```",
    "\n",
    "**Array form** — any group triggers the scenario (OR of ANDs):",
    "```yaml",
    "_when:",
    "  - body.role: admin",
    "  - body.role: superadmin",
    "```",
    "\n",
    "Condition keys use dot-notation: `body.x`, `params.x`, `query.x`, `headers.x`.",
    "Operator suffixes supported: `_ne`, `_like`, `_start`, `_regex`, `_gte`, `_lte`.",
  ].join("\n"),

  // ── Top-level blocks ───────────────────────────────────────────────────────
  _rel: [
    "## `_rel`",
    "Defines relationships between root collections.",
    "\n",
    "Each key must match a root collection name. Fields inside declare the",
    "relation using shorthand, DSL string, or verbose object form.",
    "\n",
    "```yaml",
    "_rel:",
    "  posts:",
    "    userId: users                        # shorthand",
    '    tags: "m2m:tags@post_tags(postId,tagId)[0..n->0..n]"  # DSL',
    "```",
  ].join("\n"),

  _routes: [
    "## `_routes`",
    "Defines custom non-CRUD endpoints that don't fit a collection.",
    "\n",
    "Supports static responses, template variables, conditional scenarios,",
    "per-route delays, error injection and handler functions.",
    "\n",
    "```yaml",
    "_routes:",
    "  - method: POST",
    "    path: /auth/login",
    "    response:",
    "      status: 200",
    '      body: { token: "{{uuid}}" }',
    "```",
  ].join("\n"),

  _schema: [
    "## `_schema`",
    "Declares field-level type annotations for a collection.",
    "\n",
    "Used to generate accurate OpenAPI 3.0 output. Fields not declared",
    "in `_schema` are inferred from the data and treated as optional.",
    "\n",
    "```yaml",
    "_schema:",
    "  orders:",
    "    status: required                     # shorthand",
    "    total: { type: number, required: true }",
    "```",
  ].join("\n"),

  // ── Verbose relation keys ──────────────────────────────────────────────────
  _type: [
    "## `_type`",
    "Relation type for the verbose object form.",
    "\n",
    "| Value | Meaning |",
    "|---|---|",
    "| `many2one` / `m2o` | Many records here → one in target (FK on this side) |",
    "| `one2one` / `o2o` | One record here ↔ one in target |",
    "| `many2many` / `m2m` | Many ↔ many via a pivot collection |",
    "\n",
    "```yaml",
    "_type: many2one",
    "```",
  ].join("\n"),

  _target: [
    "## `_target`",
    "The target collection this relation points to.",
    "\n",
    "Must match a root collection name defined in the same file.",
    "\n",
    "```yaml",
    "_target: users",
    "```",
  ].join("\n"),

  _foreignKey: [
    "## `_foreignKey`",
    "The field on **this** collection that holds the foreign key.",
    "\n",
    "Defaults to the YAML key name when omitted.",
    "\n",
    "```yaml",
    "_foreignKey: userId",
    "```",
  ].join("\n"),

  _otherKey: [
    "## `_otherKey`",
    "For `many2many`: the FK pointing to the **target** collection in the pivot.",
    "\n",
    "```yaml",
    "_through: post_tags",
    "_foreignKey: postId   # FK to this collection",
    "_otherKey: tagId      # FK to target collection",
    "```",
  ].join("\n"),

  _primaryKey: [
    "## `_primaryKey`",
    "The primary key field on the **target** collection.",
    "\n",
    "Defaults to `id` when omitted.",
    "\n",
    "```yaml",
    "_primaryKey: id",
    "```",
  ].join("\n"),

  _through: [
    "## `_through`",
    "For `many2many`: the pivot/junction collection that links both sides.",
    "\n",
    "```yaml",
    "tags:",
    "  _type: many2many",
    "  _target: tags",
    "  _through: post_tags",
    "  _foreignKey: postId",
    "  _otherKey: tagId",
    "```",
  ].join("\n"),

  _nested: [
    "## `_nested`",
    "When `true`, the related object is auto-embedded in every GET response",
    "without needing `?_expand` or `?_embed`.",
    "\n",
    "- `many2one` / `one2one`: embeds the parent object under a derived key (`userId` → `user`)",
    "- `many2many`: embeds the resolved target array under the alias key",
    "\n",
    "```yaml",
    "_nested: true",
    "```",
  ].join("\n"),

  "_car-direct": [
    "## `_car-direct`",
    "Cardinality from **this** record → the target.",
    "\n",
    "| Notation | Meaning |",
    "|---|---|",
    "| `1..1` | Exactly one (mandatory) |",
    "| `0..1` | Zero or one (optional) |",
    "| `1..n` | One or more |",
    "| `0..n` | Zero or more |",
    "\n",
    "```yaml",
    "_car-direct: 1..1",
    "```",
  ].join("\n"),

  "_car-inverse": [
    "## `_car-inverse`",
    "Cardinality from the **target** back to this collection.",
    "\n",
    "| Notation | Meaning |",
    "|---|---|",
    "| `1..1` | Exactly one (mandatory) |",
    "| `0..1` | Zero or one (optional) |",
    "| `1..n` | One or more |",
    "| `0..n` | Zero or more |",
    "\n",
    "```yaml",
    "_car-inverse: 0..n",
    "```",
  ].join("\n"),

  // ── Relation types ─────────────────────────────────────────────────────────
  many2one: [
    "## `many2one` — alias `m2o`",
    "Many records here → one record in target. The FK lives on **this** side.",
    "\n",
    "```yaml",
    "_rel:",
    "  posts:",
    '    userId: "m2o:users[1..1->0..n]"   # DSL',
    "    # or verbose:",
    "    userId:",
    "      _type: many2one",
    "      _target: users",
    "```",
  ].join("\n"),

  m2o: [
    "## `m2o` — full name `many2one`",
    "Many records here → one record in target. The FK lives on **this** side.",
    "\n",
    "```yaml",
    'userId: "m2o:users[1..1->0..n]+nested"',
    "```",
  ].join("\n"),

  one2one: [
    "## `one2one` — alias `o2o`",
    "One record here ↔ one record in target. `GET /parent/:id/child` returns a single object.",
    "\n",
    "```yaml",
    "_rel:",
    "  profiles:",
    '    userId: "o2o:users[1..1->1..1]"',
    "```",
  ].join("\n"),

  o2o: [
    "## `o2o` — full name `one2one`",
    "One record here ↔ one record in target. `GET /parent/:id/child` returns a single object.",
    "\n",
    "```yaml",
    'userId: "o2o:users[1..1->1..1]"',
    "```",
  ].join("\n"),

  many2many: [
    "## `many2many` — alias `m2m`",
    "Many ↔ many, resolved via a pivot/junction collection (`_through`).",
    "Automatically registers both directions: `GET /a/:id/b` and `GET /b/:id/a`.",
    "\n",
    "```yaml",
    "_rel:",
    "  posts:",
    '    tags: "m2m:tags@post_tags(postId,tagId)[0..n->0..n]"',
    "```",
  ].join("\n"),

  m2m: [
    "## `m2m` — full name `many2many`",
    "Many ↔ many, resolved via a pivot/junction collection (`_through`).",
    "\n",
    "```yaml",
    'tags: "m2m:tags@post_tags(postId,tagId)[0..n->0..n]+nested"',
    "```",
  ].join("\n"),

  one2many: [
    "## `one2many` — alias `o2m`",
    "One record here → many records in target. The FK lives on the **target** side.",
    "\n",
    "```yaml",
    "_rel:",
    "  users:",
    "    posts:",
    "      _type: one2many",
    "      _target: posts",
    "      _foreignKey: userId",
    "```",
  ].join("\n"),

  o2m: [
    "## `o2m` — full name `one2many`",
    "One record here → many records in target. The FK lives on the **target** side.",
    "\n",
    "```yaml",
    'posts: "o2m:posts@userId[1..1->0..n]"',
    "```",
  ].join("\n"),

  // ── Cardinality ────────────────────────────────────────────────────────────
  "1..1": [
    "## `1..1` — Exactly one",
    "Mandatory and singular. The relation must always resolve to exactly one record.",
    "\n",
    "Used in `_car-direct` / `_car-inverse` or inside a DSL string `[1..1->...]`.",
    "\n",
    "```yaml",
    "_car-direct: 1..1   # this record always has exactly one target",
    "```",
  ].join("\n"),

  "0..1": [
    "## `0..1` — Zero or one",
    "Optional and singular. The relation may be absent or resolve to one record.",
    "\n",
    "Used in `_car-direct` / `_car-inverse` or inside a DSL string `[0..1->...]`.",
    "\n",
    "```yaml",
    "_car-inverse: 0..1   # target may or may not have this record",
    "```",
  ].join("\n"),

  "1..n": [
    "## `1..n` — One or more",
    "Mandatory and plural. At least one related record must exist.",
    "\n",
    "Used in `_car-direct` / `_car-inverse` or inside a DSL string `[...->1..n]`.",
    "\n",
    "```yaml",
    "_car-inverse: 1..n   # target always has at least one of these",
    "```",
  ].join("\n"),

  "0..n": [
    "## `0..n` — Zero or more",
    "Optional and plural. Any number of related records, including none.",
    "\n",
    "Used in `_car-direct` / `_car-inverse` or inside a DSL string `[...->0..n]`.",
    "\n",
    "```yaml",
    "_car-inverse: 0..n   # target may have any number of these",
    "```",
  ].join("\n"),

  // ── DSL flags ──────────────────────────────────────────────────────────────
  "+nested": [
    "## `+nested`",
    "Appended to a DSL string to enable auto-embedding (`_nested: true`).",
    "\n",
    "```yaml",
    'userId: "m2o:users[1..1->0..n]+nested"',
    "```",
  ].join("\n"),
};

// ─── Template literal detection ───────────────────────────────────────────────

/** Languages that support `yrest\`...\`` tagged template literals. */
const JS_LANGUAGES = new Set([
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
]);

/**
 * Returns `true` when `position` is inside a `yrest\`...\`` tagged template
 * literal in a TypeScript or JavaScript document.
 *
 * Scans backwards for the opening `yrest\`` tag and forwards for the closing
 * backtick. A simple linear scan is sufficient because yrest template blocks
 * are typically small and the check only runs on hover.
 */
function isInsideYrestTemplate(
  document: vscode.TextDocument,
  position: vscode.Position,
): boolean {
  const text = document.getText();
  const offset = document.offsetAt(position);

  const openIdx = text.lastIndexOf("yrest`", offset);
  if (openIdx === -1) return false;

  const closeIdx = text.indexOf("`", openIdx + 6);
  if (closeIdx === -1) return false;

  return offset > openIdx + 5 && offset <= closeIdx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Registers the hover provider for `yrest` documents and for `yrest\`...\``
 * tagged template literals inside TypeScript and JavaScript files.
 *
 * @param context - The extension context used to track disposables.
 */
export function registerHoverProvider(context: vscode.ExtensionContext): void {
  const handler: vscode.HoverProvider = {
    provideHover(document, position) {
      if (
        JS_LANGUAGES.has(document.languageId) &&
        !isInsideYrestTemplate(document, position)
      ) {
        return;
      }

      const range = document.getWordRangeAtPosition(position, TOKEN_REGEX);
      if (!range) return;

      const word = document.getText(range);
      const doc = DOCS[word];
      if (!doc) return;

      const content = new vscode.MarkdownString(doc);
      content.isTrusted = true;
      return new vscode.Hover(content, range);
    },
  };

  const languages = [
    "yrest",
    "typescript",
    "javascript",
    "typescriptreact",
    "javascriptreact",
  ];
  for (const lang of languages) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(lang, handler),
    );
  }
}

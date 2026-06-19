/**
 * Shared constants for yrest validation and syntax support.
 *
 * These values mirror the rules enforced by `@yrest/core` at runtime.
 * When `@yrest/core` is published as an npm package, these should be
 * imported from it directly instead of being duplicated here.
 */

/**
 * All accepted relation type identifiers, including full names and DSL aliases.
 *
 * @example `many2one`, `m2o`, `one2one`, `o2o`, `many2many`, `m2m`
 */
export const VALID_RELATION_TYPES = new Set([
  "many2one",
  "one2many",
  "one2one",
  "many2many",
  "m2o",
  "o2m",
  "o2o",
  "m2m",
]);

/**
 * All accepted cardinality notation values for `_car-direct` and `_car-inverse`.
 *
 * Format: `min..max` where min is `0` or `1` and max is `1` or `n`.
 *
 * @example `1..1`, `0..1`, `1..n`, `0..n`
 */
export const VALID_CARDINALITIES = new Set(["0..1", "1..1", "1..n", "0..n"]);

/**
 * Regex for the compact DSL relation string format.
 *
 * Captures:
 * 1. Relation type alias or full name (`m2o`, `many2one`, etc.)
 * 2. Target collection name
 * 3. Foreign key field (optional, after `@`)
 * 4. Direct cardinality (optional, inside `[...]`)
 * 5. Inverse cardinality (optional, inside `[...]`)
 * 6. `+nested` flag (optional)
 *
 * @example `"m2o:users[1..1->0..n]+nested"`
 * @example `"m2m:tags@post_tags(postId,tagId)[0..n->0..n]"`
 */
export const DSL_REGEX =
  /^(m2o|o2o|m2m|many2one|one2one|many2many):([^@[\s(]+)(?:@([^[(+\s]+)(?:\([^)]+\))?)?(?:\[([0-9n]\.[.][0-9n1])->([0-9n]\.[.][0-9n1])\])?(\+nested)?$/;

/**
 * yrest-specific YAML keys that are reserved and must not be treated as collection names.
 */
export const RESERVED_KEYS = new Set(["_rel", "_routes", "_schema"]);

/**
 * Keys valid at the top level of a `_routes` list entry.
 */
export const ROUTE_ENTRY_KEYS = [
  { label: "_method", detail: "HTTP method: GET, POST, PUT, PATCH, DELETE…" },
  { label: "_path", detail: "URL path, supports :param segments" },
  { label: "_handler", detail: "Handler function name from yrest.handlers.js" },
  {
    label: "_response",
    detail: "Static response block (_status, _body, _headers)",
  },
  { label: "_scenarios", detail: "List of conditional response variants" },
  { label: "_otherwise", detail: "Fallback when no scenario matches" },
  { label: "_delay", detail: "Simulated latency in ms before responding" },
  { label: "_error", detail: "Force an HTTP error status (e.g. 503)" },
  { label: "_errorBody", detail: "Body returned alongside _error" },
] as const;

/**
 * Keys valid inside a `_response` or `_otherwise` block.
 */
export const RESPONSE_BLOCK_KEYS = [
  { label: "_status", detail: "HTTP status code (default: 200)" },
  { label: "_body", detail: "Response body — any YAML value" },
  { label: "_headers", detail: "Additional response headers" },
] as const;

/**
 * Keys valid inside a `_scenarios` list entry.
 */
export const SCENARIO_ENTRY_KEYS = [
  {
    label: "_when",
    detail: "Condition: object (AND) or array of objects (OR of ANDs)",
  },
  {
    label: "_response",
    detail: "Response returned when the condition matches",
  },
] as const;

/**
 * Bare (no-underscore) keys that are invalid at the top level of a `_routes` entry.
 * Maps the wrong key → the correct `_`-prefixed key.
 */
export const BARE_ROUTE_ENTRY_KEYS: Record<string, string> = {
  method: "_method",
  path: "_path",
  handler: "_handler",
  response: "_response",
  scenarios: "_scenarios",
  otherwise: "_otherwise",
  delay: "_delay",
  error: "_error",
  errorBody: "_errorBody",
};

/**
 * Bare keys invalid inside a `_response` or `_otherwise` block.
 */
export const BARE_RESPONSE_KEYS: Record<string, string> = {
  status: "_status",
  body: "_body",
  headers: "_headers",
};

/**
 * Bare keys invalid inside a `_scenarios` list entry.
 */
export const BARE_SCENARIO_KEYS: Record<string, string> = {
  when: "_when",
  response: "_response",
};

/** HTTP methods accepted by `_method`. */
export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

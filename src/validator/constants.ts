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

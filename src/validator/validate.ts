/**
 * Pure validation logic for yrest YAML documents.
 *
 * This module has no dependency on the `vscode` API and can be executed in
 * any Node.js environment — including Vitest unit tests. `validator.ts`
 * wraps these functions and converts the results to `vscode.Diagnostic` objects.
 *
 * @module validate
 */

import {
  VALID_RELATION_TYPES,
  VALID_CARDINALITIES,
  DSL_REGEX,
  RESERVED_KEYS,
  BARE_ROUTE_ENTRY_KEYS,
  BARE_RESPONSE_KEYS,
  BARE_SCENARIO_KEYS,
} from "./constants.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A validation problem produced by the pure validation pass. */
export type ValidationIssue = {
  /** The string token to highlight in the document (searched by text). */
  token: string;
  /** Human-readable message shown in the Problems panel. */
  message: string;
};

/** Shape of a verbose relation object inside `_rel`. */
type VerboseRelDef = Record<string, unknown>;

/** A relation definition: shorthand string, DSL string, or verbose object. */
type RelDef = string | VerboseRelDef;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts user-defined collection names from a parsed root YAML object.
 *
 * Reserved keys (`_rel`, `_routes`, `_schema`) are excluded. Only keys whose
 * values are arrays (i.e. actual data collections) are considered collections.
 *
 * @param data - The parsed root YAML object.
 * @returns    Array of collection names present in the document.
 */
export function extractCollections(data: Record<string, unknown>): string[] {
  return Object.entries(data)
    .filter(([key, val]) => !RESERVED_KEYS.has(key) && Array.isArray(val))
    .map(([key]) => key);
}

/**
 * Validates the `_rel` block of a parsed yrest document.
 *
 * @param data        - Parsed root YAML object.
 * @param collections - Known collection names (from {@link extractCollections}).
 * @returns           Array of validation issues found (empty if valid).
 */
export function validateRelations(
  data: Record<string, unknown>,
  collections: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rel = data["_rel"];
  if (!rel) return issues;

  if (typeof rel !== "object" || Array.isArray(rel)) {
    issues.push({ token: "_rel", message: "_rel must be a YAML object." });
    return issues;
  }

  for (const [entity, fields] of Object.entries(
    rel as Record<string, unknown>,
  )) {
    if (!collections.includes(entity)) {
      issues.push({
        token: entity,
        message: `"${entity}" is not a root collection in this file.`,
      });
      continue;
    }

    if (!fields || typeof fields !== "object" || Array.isArray(fields))
      continue;

    for (const [field, def] of Object.entries(
      fields as Record<string, unknown>,
    )) {
      issues.push(...validateRelDef(collections, field, def as RelDef));
    }
  }

  return issues;
}

/**
 * Validates the `_routes` block of a parsed yrest document.
 *
 * Reports any bare (non-`_`-prefixed) key that should carry the `_` prefix
 * per the yrest reserved-word convention (v0.11.0+).
 *
 * @param data - Parsed root YAML object.
 * @returns    Array of validation issues found (empty if valid).
 */
export function validateRoutes(
  data: Record<string, unknown>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const routes = data["_routes"];
  if (!Array.isArray(routes)) return issues;

  for (const entry of routes) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const route = entry as Record<string, unknown>;

    // Top-level route entry keys
    for (const key of Object.keys(route)) {
      if (BARE_ROUTE_ENTRY_KEYS[key]) {
        issues.push({
          token: key,
          message: `Use \`${BARE_ROUTE_ENTRY_KEYS[key]}\` instead of \`${key}\` inside _routes entries.`,
        });
      }
    }

    // Keys inside _response and _otherwise blocks
    for (const blockKey of [
      "_response",
      "_otherwise",
      "response",
      "otherwise",
    ] as const) {
      const block = route[blockKey];
      if (!block || typeof block !== "object" || Array.isArray(block)) continue;
      for (const key of Object.keys(block as Record<string, unknown>)) {
        if (BARE_RESPONSE_KEYS[key]) {
          issues.push({
            token: key,
            message: `Use \`${BARE_RESPONSE_KEYS[key]}\` instead of \`${key}\` inside a response block.`,
          });
        }
      }
    }

    // Keys inside _scenarios entries
    for (const scenariosKey of ["_scenarios", "scenarios"] as const) {
      const scenarios = route[scenariosKey];
      if (!Array.isArray(scenarios)) continue;
      for (const scenario of scenarios) {
        if (
          !scenario ||
          typeof scenario !== "object" ||
          Array.isArray(scenario)
        )
          continue;
        for (const key of Object.keys(scenario as Record<string, unknown>)) {
          if (BARE_SCENARIO_KEYS[key]) {
            issues.push({
              token: key,
              message: `Use \`${BARE_SCENARIO_KEYS[key]}\` instead of \`${key}\` inside a _scenarios entry.`,
            });
          }
        }
      }
    }
  }

  return issues;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function validateRelDef(
  collections: string[],
  field: string,
  def: RelDef,
): ValidationIssue[] {
  if (typeof def === "string")
    return validateStringRelDef(collections, def, field);

  if (typeof def === "object" && def !== null && !Array.isArray(def)) {
    return validateVerboseRelDef(collections, field, def);
  }

  return [
    {
      token: field,
      message:
        `Invalid relation definition for "${field}". ` +
        `Use a shorthand string, DSL string, or verbose object with _type and _target.`,
    },
  ];
}

function validateStringRelDef(
  collections: string[],
  def: string,
  field: string,
): ValidationIssue[] {
  if (DSL_REGEX.test(def)) {
    const match = def.match(DSL_REGEX)!;
    const target = match[2];
    if (!collections.includes(target)) {
      return [
        {
          token: target,
          message: `DSL target "${target}" is not a root collection.`,
        },
      ];
    }
    return [];
  }

  if (!collections.includes(def)) {
    return [
      { token: def, message: `Target "${def}" is not a root collection.` },
    ];
  }

  return [];
}

function validateVerboseRelDef(
  collections: string[],
  field: string,
  def: VerboseRelDef,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const relType = def["_type"] as string | undefined;
  const target = def["_target"] as string | undefined;

  if (!relType) {
    issues.push({
      token: field,
      message: `Relation "${field}" is missing _type.`,
    });
  } else if (!VALID_RELATION_TYPES.has(relType)) {
    issues.push({
      token: relType,
      message:
        `Invalid relation type "${relType}". ` +
        `Accepted values: many2one, one2one, many2many (or aliases m2o, o2o, m2m).`,
    });
  }

  if (!target) {
    issues.push({
      token: field,
      message: `Relation "${field}" is missing _target.`,
    });
  } else if (!collections.includes(target)) {
    issues.push({
      token: target,
      message: `Target "${target}" is not a root collection.`,
    });
  }

  for (const key of ["_car-direct", "_car-inverse"] as const) {
    const val = def[key] as string | undefined;
    if (val && !VALID_CARDINALITIES.has(val)) {
      issues.push({
        token: val,
        message:
          `Invalid cardinality "${val}" for ${key}. ` +
          `Accepted values: ${[...VALID_CARDINALITIES].join(", ")}.`,
      });
    }
  }

  return issues;
}

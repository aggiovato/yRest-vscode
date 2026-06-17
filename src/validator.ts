/**
 * YRest document validator.
 *
 * Validates a `db.yml` or `*.yrest.yml` document in two passes:
 *
 * 1. **YAML parse pass** — delegates to the `yaml` parser; any syntax error
 *    is reported immediately and further validation is skipped.
 *
 * 2. **YRest semantic pass** — validates the `_rel` block: entity names must
 *    match root collections, relation definitions must reference existing targets,
 *    relation types and cardinalities must use accepted values.
 *
 * @module validator
 */

import * as vscode from "vscode";
import { parseDocument } from "yaml";
import { VALID_RELATION_TYPES, VALID_CARDINALITIES, DSL_REGEX, RESERVED_KEYS } from "./constants.js";
import { diagnosticAtToken, diagnosticAtOffset } from "./diagnostics.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of a verbose relation object inside `_rel`. */
type VerboseRelDef = Record<string, unknown>;

/** A relation definition: shorthand string, DSL string, or verbose object. */
type RelDef = string | VerboseRelDef;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates a full YRest document and returns all diagnostics found.
 *
 * This is the single entry point consumed by `extension.ts`. It is called on
 * every document open and change event for documents with `languageId === "yrest"`.
 *
 * @param doc - The active VS Code text document to validate.
 * @returns   Array of diagnostics (may be empty if the document is valid).
 */
export function validateYrestDocument(doc: vscode.TextDocument): vscode.Diagnostic[] {
  const text = doc.getText();
  const diagnostics: vscode.Diagnostic[] = [];

  const yamlDoc = parseDocument(text, { prettyErrors: false });

  collectYamlErrors(doc, yamlDoc.errors, diagnostics);
  if (yamlDoc.errors.length > 0) return diagnostics;

  const data = yamlDoc.toJSON() as Record<string, unknown> | null;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    diagnostics.push(diagnosticAtOffset(doc, 0, 1, "YRest file must contain a YAML object at root."));
    return diagnostics;
  }

  const collections = extractCollections(data);
  validateRelBlock(doc, text, data, collections, diagnostics);

  return diagnostics;
}

// ─── Pass 1 — YAML errors ─────────────────────────────────────────────────────

/**
 * Converts raw YAML parse errors into VS Code diagnostics with accurate ranges.
 *
 * @param doc         - The document being validated.
 * @param errors      - The `errors` array from `yaml.parseDocument()`.
 * @param diagnostics - Accumulator array; diagnostics are pushed in place.
 */
function collectYamlErrors(
  doc: vscode.TextDocument,
  errors: { pos: number[]; message: string }[],
  diagnostics: vscode.Diagnostic[]
): void {
  for (const yamlErr of errors) {
    const pos = Array.isArray(yamlErr.pos) ? yamlErr.pos : [0, 1];
    diagnostics.push(diagnosticAtOffset(doc, pos[0], pos[1], yamlErr.message));
  }
}

// ─── Pass 2 — YRest semantics ─────────────────────────────────────────────────

/**
 * Extracts user-defined collection names from the root of the parsed YAML.
 *
 * Reserved keys (`_rel`, `_routes`, `_schema`) are excluded; only keys whose
 * values are arrays (i.e. actual data collections) are considered collections.
 *
 * @param data - The parsed root YAML object.
 * @returns    Array of collection names present in the document.
 */
function extractCollections(data: Record<string, unknown>): string[] {
  return Object.entries(data)
    .filter(([key, val]) => !RESERVED_KEYS.has(key) && Array.isArray(val))
    .map(([key]) => key);
}

/**
 * Validates the `_rel` block of a YRest document.
 *
 * Checks that:
 * - `_rel` is a plain object (not an array or scalar).
 * - Each entity key inside `_rel` corresponds to a root collection.
 * - Each relation field under an entity is a valid relation definition.
 *
 * @param doc         - The document being validated.
 * @param text        - Raw document text for token-search diagnostics.
 * @param data        - Parsed root YAML object.
 * @param collections - Known collection names derived from the root document.
 * @param diagnostics - Accumulator array; diagnostics are pushed in place.
 */
function validateRelBlock(
  doc: vscode.TextDocument,
  text: string,
  data: Record<string, unknown>,
  collections: string[],
  diagnostics: vscode.Diagnostic[]
): void {
  const rel = data["_rel"];
  if (!rel) return;

  if (typeof rel !== "object" || Array.isArray(rel)) {
    diagnostics.push(diagnosticAtToken(doc, text, "_rel", "_rel must be a YAML object."));
    return;
  }

  for (const [entity, fields] of Object.entries(rel as Record<string, unknown>)) {
    if (!collections.includes(entity)) {
      diagnostics.push(diagnosticAtToken(
        doc, text, entity,
        `"${entity}" is not a root collection in this file.`
      ));
      continue;
    }

    if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;

    for (const [field, def] of Object.entries(fields as Record<string, unknown>)) {
      validateRelDef(doc, text, collections, field, def as RelDef, diagnostics);
    }
  }
}

/**
 * Validates a single relation definition for a given field.
 *
 * Dispatches to the appropriate sub-validator based on the shape of `def`:
 * - Plain string → shorthand (`field: targetCollection`)
 * - DSL string   → compact format (`"m2o:target@fk[1..1->0..n]+nested"`)
 * - Object       → verbose form (`{ _type, _target, _car-direct, ... }`)
 *
 * @param doc         - The document being validated.
 * @param text        - Raw document text for token-search diagnostics.
 * @param collections - Known collection names to validate targets against.
 * @param field       - The YAML field name declaring this relation.
 * @param def         - The relation definition value (string or object).
 * @param diagnostics - Accumulator array; diagnostics are pushed in place.
 */
function validateRelDef(
  doc: vscode.TextDocument,
  text: string,
  collections: string[],
  field: string,
  def: RelDef,
  diagnostics: vscode.Diagnostic[]
): void {
  if (typeof def === "string") {
    validateStringRelDef(doc, text, collections, def, diagnostics);
    return;
  }

  if (typeof def === "object" && def !== null && !Array.isArray(def)) {
    validateVerboseRelDef(doc, text, collections, field, def, diagnostics);
    return;
  }

  diagnostics.push(diagnosticAtToken(
    doc, text, field,
    `Invalid relation definition for "${field}". ` +
    `Use a shorthand string, DSL string, or verbose object with _type and _target.`
  ));
}

/**
 * Validates a string relation definition.
 *
 * Accepts two forms:
 * - Shorthand: `"targetCollection"` — must be an existing collection name.
 * - DSL string: `"m2o:target@fk[1..1->0..n]+nested"` — validated with {@link DSL_REGEX}.
 *
 * @param doc         - The document being validated.
 * @param text        - Raw document text.
 * @param collections - Known collection names.
 * @param def         - The string value to validate.
 * @param diagnostics - Accumulator array.
 */
function validateStringRelDef(
  doc: vscode.TextDocument,
  text: string,
  collections: string[],
  def: string,
  diagnostics: vscode.Diagnostic[]
): void {
  if (DSL_REGEX.test(def)) {
    const match = def.match(DSL_REGEX)!;
    const target = match[2];
    if (!collections.includes(target)) {
      diagnostics.push(diagnosticAtToken(
        doc, text, target,
        `DSL target "${target}" is not a root collection.`
      ));
    }
    return;
  }

  if (!collections.includes(def)) {
    diagnostics.push(diagnosticAtToken(
      doc, text, def,
      `Target "${def}" is not a root collection.`
    ));
  }
}

/**
 * Validates a verbose relation object (`_type`, `_target`, `_car-direct`, `_car-inverse`).
 *
 * Checks:
 * - `_type` is present and is an accepted relation type.
 * - `_target` is present and refers to an existing collection.
 * - `_car-direct` and `_car-inverse`, if present, use accepted cardinality notation.
 *
 * @param doc         - The document being validated.
 * @param text        - Raw document text.
 * @param collections - Known collection names.
 * @param field       - The parent YAML field name (used for missing-key messages).
 * @param def         - The parsed object containing `_type`, `_target`, etc.
 * @param diagnostics - Accumulator array.
 */
function validateVerboseRelDef(
  doc: vscode.TextDocument,
  text: string,
  collections: string[],
  field: string,
  def: VerboseRelDef,
  diagnostics: vscode.Diagnostic[]
): void {
  const relType = def["_type"] as string | undefined;
  const target = def["_target"] as string | undefined;

  if (!relType) {
    diagnostics.push(diagnosticAtToken(
      doc, text, field,
      `Relation "${field}" is missing _type.`
    ));
  } else if (!VALID_RELATION_TYPES.has(relType)) {
    diagnostics.push(diagnosticAtToken(
      doc, text, relType,
      `Invalid relation type "${relType}". ` +
      `Accepted values: many2one, one2one, many2many (or aliases m2o, o2o, m2m).`
    ));
  }

  if (!target) {
    diagnostics.push(diagnosticAtToken(
      doc, text, field,
      `Relation "${field}" is missing _target.`
    ));
  } else if (!collections.includes(target)) {
    diagnostics.push(diagnosticAtToken(
      doc, text, target,
      `Target "${target}" is not a root collection.`
    ));
  }

  validateCardinality(doc, text, def, "_car-direct", diagnostics);
  validateCardinality(doc, text, def, "_car-inverse", diagnostics);
}

/**
 * Validates a single cardinality field (`_car-direct` or `_car-inverse`) on a
 * verbose relation object.
 *
 * Silently skips the check when the field is absent — cardinality is optional.
 *
 * @param doc         - The document being validated.
 * @param text        - Raw document text.
 * @param def         - The verbose relation object containing the cardinality field.
 * @param key         - Either `"_car-direct"` or `"_car-inverse"`.
 * @param diagnostics - Accumulator array.
 */
function validateCardinality(
  doc: vscode.TextDocument,
  text: string,
  def: VerboseRelDef,
  key: "_car-direct" | "_car-inverse",
  diagnostics: vscode.Diagnostic[]
): void {
  const val = def[key] as string | undefined;
  if (!val) return;

  if (!VALID_CARDINALITIES.has(val)) {
    diagnostics.push(diagnosticAtToken(
      doc, text, val,
      `Invalid cardinality "${val}" for ${key}. ` +
      `Accepted values: ${[...VALID_CARDINALITIES].join(", ")}.`
    ));
  }
}

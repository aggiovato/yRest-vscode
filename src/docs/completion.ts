/**
 * Completion provider for yrest YAML files.
 *
 * Provides context-aware autocomplete for:
 * - `_type` values: relation types and aliases
 * - `_target` / `_through` values: collection names from the document
 * - `_car-direct` / `_car-inverse` values: cardinality notation
 * - `_nested` values: boolean
 * - Verbose relation keys inside a `_rel` object block
 * - Shorthand relation values: collection names
 * - `_method` values: HTTP methods
 * - `_routes` entry keys: `_method`, `_path`, `_handler`, `_response`, etc.
 * - `_response` / `_otherwise` block keys: `_status`, `_body`, `_headers`
 * - `_scenarios` entry keys: `_when`, `_response`
 *
 * @module completion
 */

import * as vscode from "vscode";
import { parse } from "yaml";
import {
  RESERVED_KEYS,
  ROUTE_ENTRY_KEYS,
  RESPONSE_BLOCK_KEYS,
  SCENARIO_ENTRY_KEYS,
  HTTP_METHODS,
} from "../validator/constants.js";

// ─── Static completion lists ──────────────────────────────────────────────────

const RELATION_TYPES = [
  { label: "many2one", detail: "alias: m2o" },
  { label: "one2one", detail: "alias: o2o" },
  { label: "many2many", detail: "alias: m2m" },
  { label: "one2many", detail: "alias: o2m" },
  { label: "m2o", detail: "full name: many2one" },
  { label: "o2o", detail: "full name: one2one" },
  { label: "m2m", detail: "full name: many2many" },
  { label: "o2m", detail: "full name: one2many" },
];

const CARDINALITIES = [
  { label: "1..1", detail: "Exactly one (mandatory)" },
  { label: "0..1", detail: "Zero or one (optional)" },
  { label: "1..n", detail: "One or more (mandatory)" },
  { label: "0..n", detail: "Zero or more (optional)" },
];

const VERBOSE_REL_KEYS = [
  { label: "_type", detail: "Relation type: many2one, one2one, many2many" },
  { label: "_target", detail: "Target collection name" },
  { label: "_foreignKey", detail: "FK field on this collection" },
  { label: "_otherKey", detail: "FK to target collection (many2many pivot)" },
  { label: "_primaryKey", detail: "PK field on target (default: id)" },
  { label: "_through", detail: "Pivot/junction collection (many2many)" },
  { label: "_car-direct", detail: "Cardinality: this record → target" },
  { label: "_car-inverse", detail: "Cardinality: target → this collection" },
  { label: "_nested", detail: "Auto-embed in every GET response" },
];

// ─── Context detection ────────────────────────────────────────────────────────

/**
 * Determines the completion context based on the current line and document position.
 *
 * Returns a string describing what kind of completions should be offered,
 * or `null` when no yrest-specific completions apply.
 */
type CompletionContext =
  | "type-value"
  | "collection-value"
  | "cardinality-value"
  | "nested-value"
  | "method-value"
  | "verbose-key"
  | "shorthand-value"
  | "route-entry-key"
  | "response-block-key"
  | "scenario-entry-key"
  | null;

function getCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  linePrefix: string,
): CompletionContext {
  // ── Value completions (line-prefix is enough) ────────────────────────────
  if (/_type:\s*$/.test(linePrefix)) return "type-value";
  if (/(_target|_through):\s*$/.test(linePrefix)) return "collection-value";
  if (/_car-(direct|inverse):\s*$/.test(linePrefix)) return "cardinality-value";
  if (/_nested:\s*$/.test(linePrefix)) return "nested-value";
  if (/_method:\s*$/.test(linePrefix)) return "method-value";

  // ── Key completions (need block context) ─────────────────────────────────
  const indent = linePrefix.match(/^(\s*)/)?.[1].length ?? 0;
  const isKeyPosition = /^\s*(_\w*)?$/.test(linePrefix);

  if (isKeyPosition) {
    if (isInsideBlock(document, position, "_scenarios"))
      return "scenario-entry-key";
    if (
      isInsideBlock(document, position, "_response") ||
      isInsideBlock(document, position, "_otherwise")
    )
      return "response-block-key";
    if (isInsideBlock(document, position, "_routes")) return "route-entry-key";
    if (isInsideRelBlock(document, position) && indent >= 6)
      return "verbose-key";
  }

  // ── Shorthand relation value ──────────────────────────────────────────────
  if (
    /^\s{2,}[a-zA-Z]\w*:\s*$/.test(linePrefix) &&
    isInsideRelBlock(document, position)
  ) {
    return "shorthand-value";
  }

  return null;
}

/**
 * Scans upward from `position` to find the nearest ancestor block key.
 *
 * Returns `true` when the first ancestor with lower indentation matches
 * the given `blockKey` (e.g. `"_routes"`, `"_rel"`, `"_scenarios"`).
 */
function isInsideBlock(
  document: vscode.TextDocument,
  position: vscode.Position,
  blockKey: string,
): boolean {
  const currentIndent =
    document.lineAt(position).text.match(/^(\s*)/)?.[1].length ?? 0;

  for (let i = position.line - 1; i >= 0; i--) {
    const line = document.lineAt(i).text;
    if (line.trim() === "") continue;

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent < currentIndent) {
      return new RegExp(`^\\s*${blockKey}\\s*:`).test(line);
    }
  }
  return false;
}

/**
 * Returns `true` when the cursor is inside a `_rel:` block at any nesting level.
 * Walks up recursively so verbose relation objects (indented inside entity keys) are detected.
 */
function isInsideRelBlock(
  document: vscode.TextDocument,
  position: vscode.Position,
): boolean {
  const currentIndent =
    document.lineAt(position).text.match(/^(\s*)/)?.[1].length ?? 0;

  for (let i = position.line - 1; i >= 0; i--) {
    const line = document.lineAt(i).text;
    if (line.trim() === "") continue;

    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent < currentIndent) {
      return (
        /^\s*_rel\s*:/.test(line) ||
        isInsideRelBlock(document, new vscode.Position(i, 0))
      );
    }
  }
  return false;
}

// ─── Collection name extraction ───────────────────────────────────────────────

/**
 * Parses the document and returns all root collection names.
 *
 * Falls back to an empty array when the document has YAML parse errors.
 */
function getCollectionNames(document: vscode.TextDocument): string[] {
  try {
    const data = parse(document.getText()) as Record<string, unknown> | null;
    if (!data || typeof data !== "object") return [];
    return Object.keys(data).filter(
      (k) => !RESERVED_KEYS.has(k) && Array.isArray(data[k]),
    );
  } catch {
    return [];
  }
}

// ─── Item factories ───────────────────────────────────────────────────────────

function typeItem(
  label: string,
  detail: string,
  kind: vscode.CompletionItemKind,
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(label, kind);
  item.detail = detail;
  return item;
}

function collectionItem(name: string): vscode.CompletionItem {
  return typeItem(name, "collection", vscode.CompletionItemKind.Value);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Registers the completion provider for the `yrest` language.
 *
 * Triggers on space and colon so completions appear naturally after
 * `key: ` without requiring an explicit `Ctrl+Space`.
 *
 * @param context - The extension context used to track disposables.
 */
export function registerCompletionProvider(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "yrest",
      {
        provideCompletionItems(document, position) {
          const linePrefix = document
            .lineAt(position)
            .text.substring(0, position.character);
          const ctx = getCompletionContext(document, position, linePrefix);

          switch (ctx) {
            case "type-value":
              return RELATION_TYPES.map(({ label, detail }) =>
                typeItem(label, detail, vscode.CompletionItemKind.EnumMember),
              );

            case "collection-value":
              return getCollectionNames(document).map(collectionItem);

            case "cardinality-value":
              return CARDINALITIES.map(({ label, detail }) =>
                typeItem(label, detail, vscode.CompletionItemKind.EnumMember),
              );

            case "nested-value":
              return [
                typeItem(
                  "true",
                  "Auto-embed related data in every GET response",
                  vscode.CompletionItemKind.Value,
                ),
                typeItem(
                  "false",
                  "Do not auto-embed (default)",
                  vscode.CompletionItemKind.Value,
                ),
              ];

            case "method-value":
              return HTTP_METHODS.map((m) =>
                typeItem(
                  m,
                  "HTTP method",
                  vscode.CompletionItemKind.EnumMember,
                ),
              );

            case "verbose-key":
              return VERBOSE_REL_KEYS.map(({ label, detail }) =>
                typeItem(label, detail, vscode.CompletionItemKind.Property),
              );

            case "shorthand-value":
              return getCollectionNames(document).map(collectionItem);

            case "route-entry-key":
              return ROUTE_ENTRY_KEYS.map(({ label, detail }) =>
                typeItem(label, detail, vscode.CompletionItemKind.Property),
              );

            case "response-block-key":
              return RESPONSE_BLOCK_KEYS.map(({ label, detail }) =>
                typeItem(label, detail, vscode.CompletionItemKind.Property),
              );

            case "scenario-entry-key":
              return SCENARIO_ENTRY_KEYS.map(({ label, detail }) =>
                typeItem(label, detail, vscode.CompletionItemKind.Property),
              );

            default:
              return [];
          }
        },
      },
      " ",
      ":",
    ),
  );
}

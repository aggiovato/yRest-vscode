/**
 * YRest document validator — VS Code adapter.
 *
 * Bridges the pure validation logic in `validate.ts` with the VS Code
 * `Diagnostic` API. Validates documents in two passes:
 *
 * 1. **YAML parse pass** — delegates to the `yaml` parser; any syntax error
 *    is reported immediately and further validation is skipped.
 * 2. **YRest semantic pass** — calls `validateRelations()` and converts each
 *    `ValidationIssue` to a `vscode.Diagnostic` via `diagnosticAtToken`.
 *
 * @module validator
 */

import * as vscode from "vscode";
import { parseDocument } from "yaml";
import { diagnosticAtToken, diagnosticAtOffset } from "./diagnostics.js";
import { extractCollections, validateRelations } from "./validate.js";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates a full YRest document and returns all diagnostics found.
 *
 * Entry point consumed by `extension.ts` on every document open and change.
 *
 * @param doc - The active VS Code text document to validate.
 * @returns   Array of diagnostics (empty if the document is valid).
 */
export function validateYrestDocument(
  doc: vscode.TextDocument,
): vscode.Diagnostic[] {
  const text = doc.getText();
  const diagnostics: vscode.Diagnostic[] = [];

  const yamlDoc = parseDocument(text, { prettyErrors: false });

  for (const yamlErr of yamlDoc.errors) {
    const pos = Array.isArray(yamlErr.pos) ? yamlErr.pos : [0, 1];
    diagnostics.push(diagnosticAtOffset(doc, pos[0], pos[1], yamlErr.message));
  }
  if (yamlDoc.errors.length > 0) return diagnostics;

  const data = yamlDoc.toJSON() as Record<string, unknown> | null;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    diagnostics.push(
      diagnosticAtOffset(
        doc,
        0,
        1,
        "YRest file must contain a YAML object at root.",
      ),
    );
    return diagnostics;
  }

  const collections = extractCollections(data);
  for (const issue of validateRelations(data, collections)) {
    diagnostics.push(diagnosticAtToken(doc, text, issue.token, issue.message));
  }

  return diagnostics;
}

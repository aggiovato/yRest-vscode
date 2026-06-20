/**
 * YRest document validator — VS Code adapter.
 *
 * Bridges the pure validation logic in `validate.ts` with the VS Code
 * `Diagnostic` API. Validates documents in two passes:
 *
 * 1. **YAML parse pass** — delegates to the `yaml` parser; any syntax error
 *    is reported immediately and further validation is skipped.
 * 2. **YRest semantic pass** — calls `validateRelations()`, `validateRoutes()` and
 *    converts each `ValidationIssue` to a `vscode.Diagnostic` via `diagnosticAtToken`.
 *
 * For TypeScript/JavaScript files, `validateYrestTemplates()` finds all `yrest\`...\``
 * tagged template literals and runs the same validation pipeline on their content,
 * mapping diagnostic positions back to the original document.
 *
 * @module validator
 */

import * as vscode from "vscode";
import { parseDocument } from "yaml";
import {
  diagnosticAtToken,
  diagnosticAtTokenInRange,
  diagnosticAtOffset,
} from "./diagnostics.js";
import {
  extractCollections,
  validateRelations,
  validateRoutes,
} from "./validate.js";

const JS_TS_LANGUAGES = new Set([
  "typescript",
  "javascript",
  "typescriptreact",
  "javascriptreact",
]);

const TEMPLATE_REGEX = /\byrest`([\s\S]*?)`/g;

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

  // Search within each block's section to avoid highlighting tokens that appear
  // earlier in the file (e.g. a field named "status" in _schema vs. inside _routes).
  const relOffset = Math.max(0, text.indexOf("_rel:"));
  const routesOffset = Math.max(0, text.indexOf("_routes:"));

  for (const issue of validateRelations(data, collections)) {
    diagnostics.push(
      diagnosticAtTokenInRange(doc, text, issue.token, issue.message, relOffset, text.length),
    );
  }

  for (const issue of validateRoutes(data)) {
    diagnostics.push(
      diagnosticAtTokenInRange(doc, text, issue.token, issue.message, routesOffset, text.length),
    );
  }

  return diagnostics;
}

/**
 * Finds all `yrest\`...\`` tagged template literals in a TypeScript or JavaScript
 * document and validates the YAML content inside each one.
 *
 * Diagnostic positions are offset to point at the correct location inside the
 * template, not at the start of the file.
 *
 * @param doc - A TS/JS text document that may contain yrest template literals.
 * @returns   Array of diagnostics (empty if no templates found or all are valid).
 */
export function validateYrestTemplates(
  doc: vscode.TextDocument,
): vscode.Diagnostic[] {
  if (!JS_TS_LANGUAGES.has(doc.languageId)) return [];

  const text = doc.getText();
  const diagnostics: vscode.Diagnostic[] = [];

  TEMPLATE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TEMPLATE_REGEX.exec(text)) !== null) {
    const contentStart = match.index + "yrest`".length;
    const content = match[1];
    const contentEnd = contentStart + content.length;

    const yamlDoc = parseDocument(content, { prettyErrors: false });

    for (const yamlErr of yamlDoc.errors) {
      const pos = Array.isArray(yamlErr.pos) ? yamlErr.pos : [0, 1];
      diagnostics.push(
        diagnosticAtOffset(
          doc,
          contentStart + pos[0],
          contentStart + pos[1],
          yamlErr.message,
        ),
      );
    }
    if (yamlDoc.errors.length > 0) continue;

    const data = yamlDoc.toJSON() as Record<string, unknown> | null;
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;

    const collections = extractCollections(data);

    for (const issue of validateRelations(data, collections)) {
      diagnostics.push(
        diagnosticAtTokenInRange(
          doc,
          text,
          issue.token,
          issue.message,
          contentStart,
          contentEnd,
        ),
      );
    }

    for (const issue of validateRoutes(data)) {
      diagnostics.push(
        diagnosticAtTokenInRange(
          doc,
          text,
          issue.token,
          issue.message,
          contentStart,
          contentEnd,
        ),
      );
    }
  }

  return diagnostics;
}

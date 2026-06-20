/**
 * YRest VS Code extension entry point.
 *
 * Activated automatically for documents with `languageId === "yrest"` —
 * i.e. `db.yml`, `db.yaml`, `*.yrest.yml` and `*.yrest.yaml` files.
 *
 * Registers:
 * - A `DiagnosticCollection` that validates documents on open and change.
 * - A `HoverProvider` that shows inline docs for reserved keys, relation
 *   types and cardinality notation.
 *
 * @module extension
 */

import * as vscode from "vscode";
import {
  validateYrestDocument,
  validateYrestTemplates,
} from "./validator/validator.js";
import { registerHoverProvider } from "./docs/hover.js";
import { registerCompletionProvider } from "./docs/completion.js";

let diagnostics: vscode.DiagnosticCollection;

/**
 * Called by VS Code when the extension activates.
 *
 * Sets up the diagnostic collection and all language feature providers,
 * then runs an initial validation pass on the currently open document
 * (if any) so errors are visible without needing a keystroke.
 *
 * @param context - Extension context used to register disposables.
 */
export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection("yrest");
  context.subscriptions.push(diagnostics);

  registerHoverProvider(context);
  registerCompletionProvider(context);

  if (vscode.window.activeTextEditor) {
    validate(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(validate),
    vscode.workspace.onDidChangeTextDocument((e) => validate(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnostics.delete(doc.uri),
    ),
  );
}

/**
 * Validates a document and updates the diagnostic collection.
 *
 * Silently no-ops for non-yrest documents so the handler can be registered
 * on the global `onDidOpenTextDocument` event without filtering at the
 * call site.
 *
 * @param document - The document to validate.
 */
function validate(document: vscode.TextDocument): void {
  if (document.languageId === "yrest") {
    diagnostics.set(document.uri, validateYrestDocument(document));
  } else if (
    document.languageId === "typescript" ||
    document.languageId === "javascript" ||
    document.languageId === "typescriptreact" ||
    document.languageId === "javascriptreact"
  ) {
    diagnostics.set(document.uri, validateYrestTemplates(document));
  }
}

/** Called by VS Code when the extension deactivates. */
export function deactivate(): void {}

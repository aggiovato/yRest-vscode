/**
 * Factory helpers for building `vscode.Diagnostic` objects.
 *
 * These utilities abstract the two most common patterns in yrest validation:
 * locating a token by its text content, and marking a known character range.
 */

import * as vscode from "vscode";

/** Severity shorthand used by the factory functions. */
type Severity = "error" | "warning";

const SEVERITY_MAP: Record<Severity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
};

/**
 * Creates a `Diagnostic` whose range covers the first occurrence of `token`
 * in the raw document text.
 *
 * Falls back to `[0, 1)` when the token is not found, so the diagnostic
 * always appears somewhere rather than being silently dropped.
 *
 * @param doc      - The VS Code text document being validated.
 * @param text     - Full raw text of the document (avoids repeated `getText()` calls).
 * @param token    - The string to search for in `text`.
 * @param message  - Human-readable diagnostic message shown in the Problems panel.
 * @param severity - `"error"` or `"warning"`.
 */
export function diagnosticAtToken(
  doc: vscode.TextDocument,
  text: string,
  token: string,
  message: string,
  severity: Severity = "error",
): vscode.Diagnostic {
  const idx = text.indexOf(token);
  const start = idx === -1 ? 0 : idx;
  const end = idx === -1 ? 1 : idx + token.length;
  return new vscode.Diagnostic(
    new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
    message,
    SEVERITY_MAP[severity],
  );
}

/**
 * Creates a `Diagnostic` at an explicit character offset range within the document.
 *
 * Primarily used for YAML parse errors, which provide exact positions via `err.pos`.
 *
 * @param doc         - The VS Code text document being validated.
 * @param startOffset - Start character offset (inclusive).
 * @param endOffset   - End character offset (exclusive).
 * @param message     - Human-readable diagnostic message.
 * @param severity    - `"error"` or `"warning"`. Defaults to `"error"`.
 */
export function diagnosticAtOffset(
  doc: vscode.TextDocument,
  startOffset: number,
  endOffset: number,
  message: string,
  severity: Severity = "error",
): vscode.Diagnostic {
  return new vscode.Diagnostic(
    new vscode.Range(doc.positionAt(startOffset), doc.positionAt(endOffset)),
    message,
    SEVERITY_MAP[severity],
  );
}

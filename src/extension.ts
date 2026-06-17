import * as vscode from "vscode";
import { validateYrestDocument } from "./validator.js";

let diagnostics: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  diagnostics = vscode.languages.createDiagnosticCollection("yrest");
  context.subscriptions.push(diagnostics);

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

function validate(document: vscode.TextDocument) {
  if (document.languageId !== "yrest") return;
  diagnostics.set(document.uri, validateYrestDocument(document));
}

export function deactivate() {}

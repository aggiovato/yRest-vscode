import * as vscode from "vscode";
import { parseDocument } from "yaml";

const VALID_RELATION_TYPES = new Set([
  "many2one", "one2many", "one2one", "many2many",
  "m2o", "o2m", "o2o", "m2m",
]);

const VALID_CARDINALITIES = new Set(["0..1", "1..1", "1..n", "0..n"]);

const DSL_REGEX =
  /^(m2o|o2o|m2m|many2one|one2one|many2many):([^@[\s(]+)(?:@([^[(+\s]+))?(?:\[([0-9n]\.[.][0-9n1])->([0-9n]\.[.][0-9n1])\])?(\+nested)?$/;

export function validateYrestDocument(doc: vscode.TextDocument): vscode.Diagnostic[] {
  const text = doc.getText();
  const result: vscode.Diagnostic[] = [];

  const yamlDoc = parseDocument(text, { prettyErrors: false });

  for (const err of yamlDoc.errors) {
    const pos = Array.isArray(err.pos) ? err.pos : [0, 1];
    result.push(new vscode.Diagnostic(
      new vscode.Range(doc.positionAt(pos[0]), doc.positionAt(pos[1])),
      err.message,
      vscode.DiagnosticSeverity.Error
    ));
  }
  if (yamlDoc.errors.length > 0) return result;

  const data = yamlDoc.toJSON() as Record<string, unknown> | null;
  if (!data || typeof data !== "object") {
    result.push(err(doc, text, 0, 1, "YRest file must contain a YAML object at root."));
    return result;
  }

  const collections = Object.keys(data).filter((k) => !k.startsWith("_"));
  const rel = data["_rel"];

  if (!rel) return result;

  if (typeof rel !== "object" || Array.isArray(rel)) {
    result.push(find(doc, text, "_rel", "_rel must be a YAML object.", "error"));
    return result;
  }

  for (const [entity, fields] of Object.entries(rel as Record<string, unknown>)) {
    if (!collections.includes(entity)) {
      result.push(find(doc, text, entity,
        `"${entity}" is not a root collection in this file.`, "error"));
      continue;
    }

    if (!fields || typeof fields !== "object" || Array.isArray(fields)) continue;

    for (const [field, def] of Object.entries(fields as Record<string, unknown>)) {
      validateRelDef(doc, text, collections, field, def, result);
    }
  }

  return result;
}

function validateRelDef(
  doc: vscode.TextDocument,
  text: string,
  collections: string[],
  field: string,
  def: unknown,
  result: vscode.Diagnostic[]
) {
  if (typeof def === "string") {
    if (DSL_REGEX.test(def)) {
      const m = def.match(DSL_REGEX)!;
      const target = m[2];
      if (!collections.includes(target)) {
        result.push(find(doc, text, target,
          `Target "${target}" is not a root collection.`, "error"));
      }
      return;
    }
    if (!collections.includes(def)) {
      result.push(find(doc, text, def,
        `Target "${def}" is not a root collection.`, "error"));
    }
    return;
  }

  if (typeof def === "object" && def !== null && !Array.isArray(def)) {
    const d = def as Record<string, unknown>;

    if (!d["_type"]) {
      result.push(find(doc, text, field,
        `Relation "${field}" is missing _type.`, "error"));
    } else if (!VALID_RELATION_TYPES.has(d["_type"] as string)) {
      result.push(find(doc, text, d["_type"] as string,
        `Invalid relation type "${d["_type"]}". Use many2one, one2one, or many2many.`, "error"));
    }

    if (!d["_target"]) {
      result.push(find(doc, text, field,
        `Relation "${field}" is missing _target.`, "error"));
    } else if (!collections.includes(d["_target"] as string)) {
      result.push(find(doc, text, d["_target"] as string,
        `Target "${d["_target"]}" is not a root collection.`, "error"));
    }

    for (const carKey of ["_car-direct", "_car-inverse"] as const) {
      const val = d[carKey];
      if (val && !VALID_CARDINALITIES.has(val as string)) {
        result.push(find(doc, text, val as string,
          `Invalid cardinality "${val}". Valid values: ${[...VALID_CARDINALITIES].join(", ")}.`, "error"));
      }
    }
    return;
  }

  result.push(find(doc, text, field,
    `Invalid relation definition for "${field}". Use a string target, DSL string, or object with _type/_target.`,
    "error"));
}

function find(
  doc: vscode.TextDocument,
  text: string,
  search: string,
  message: string,
  severity: "error" | "warning"
): vscode.Diagnostic {
  const idx = text.indexOf(search);
  const start = idx === -1 ? 0 : idx;
  const end = idx === -1 ? 1 : idx + search.length;
  return new vscode.Diagnostic(
    new vscode.Range(doc.positionAt(start), doc.positionAt(end)),
    message,
    severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
  );
}

function err(
  doc: vscode.TextDocument,
  _text: string,
  startOffset: number,
  endOffset: number,
  message: string
): vscode.Diagnostic {
  return new vscode.Diagnostic(
    new vscode.Range(doc.positionAt(startOffset), doc.positionAt(endOffset)),
    message,
    vscode.DiagnosticSeverity.Error
  );
}

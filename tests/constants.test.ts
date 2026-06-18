import { describe, it, expect } from "vitest";
import {
  ROUTE_ENTRY_KEYS,
  RESPONSE_BLOCK_KEYS,
  SCENARIO_ENTRY_KEYS,
  HTTP_METHODS,
  RESERVED_KEYS,
} from "../src/validator/constants.js";

describe("ROUTE_ENTRY_KEYS", () => {
  it("contains all expected route-level keys", () => {
    const labels = ROUTE_ENTRY_KEYS.map((k) => k.label);
    expect(labels).toContain("_method");
    expect(labels).toContain("_path");
    expect(labels).toContain("_handler");
    expect(labels).toContain("_response");
    expect(labels).toContain("_scenarios");
    expect(labels).toContain("_otherwise");
    expect(labels).toContain("_delay");
    expect(labels).toContain("_error");
    expect(labels).toContain("_errorBody");
  });

  it("every entry has a non-empty label and detail", () => {
    for (const { label, detail } of ROUTE_ENTRY_KEYS) {
      expect(label.length).toBeGreaterThan(0);
      expect(detail.length).toBeGreaterThan(0);
    }
  });
});

describe("RESPONSE_BLOCK_KEYS", () => {
  it("contains _status, _body and _headers", () => {
    const labels = RESPONSE_BLOCK_KEYS.map((k) => k.label);
    expect(labels).toEqual(["_status", "_body", "_headers"]);
  });
});

describe("SCENARIO_ENTRY_KEYS", () => {
  it("contains _when and _response", () => {
    const labels = SCENARIO_ENTRY_KEYS.map((k) => k.label);
    expect(labels).toEqual(["_when", "_response"]);
  });
});

describe("HTTP_METHODS", () => {
  it("contains the standard HTTP methods", () => {
    expect(HTTP_METHODS).toContain("GET");
    expect(HTTP_METHODS).toContain("POST");
    expect(HTTP_METHODS).toContain("PUT");
    expect(HTTP_METHODS).toContain("PATCH");
    expect(HTTP_METHODS).toContain("DELETE");
    expect(HTTP_METHODS).toContain("HEAD");
    expect(HTTP_METHODS).toContain("OPTIONS");
  });

  it("has no duplicates", () => {
    expect(new Set(HTTP_METHODS).size).toBe(HTTP_METHODS.length);
  });
});

describe("RESERVED_KEYS", () => {
  it("treats _rel, _routes and _schema as reserved", () => {
    expect(RESERVED_KEYS.has("_rel")).toBe(true);
    expect(RESERVED_KEYS.has("_routes")).toBe(true);
    expect(RESERVED_KEYS.has("_schema")).toBe(true);
  });

  it("does not treat user collection names as reserved", () => {
    expect(RESERVED_KEYS.has("users")).toBe(false);
    expect(RESERVED_KEYS.has("posts")).toBe(false);
  });
});

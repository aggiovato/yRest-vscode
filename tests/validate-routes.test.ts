import { describe, it, expect } from "vitest";
import { validateRoutes } from "../src/validator/validate.js";

function parse(data: Record<string, unknown>) {
  return validateRoutes(data);
}

describe("validateRoutes — no _routes block", () => {
  it("returns no issues when _routes is absent", () => {
    expect(parse({ users: [] })).toEqual([]);
  });

  it("returns no issues when _routes is not an array", () => {
    expect(parse({ _routes: {} })).toEqual([]);
  });
});

describe("validateRoutes — correct _-prefixed keys", () => {
  it("accepts valid route entries with _-prefixed keys", () => {
    const issues = parse({
      _routes: [
        {
          _method: "POST",
          _path: "/auth/login",
          _response: { _status: 200, _body: { token: "abc" } },
        },
      ],
    });
    expect(issues).toEqual([]);
  });

  it("accepts _scenarios entries with _when and _response", () => {
    const issues = parse({
      _routes: [
        {
          _method: "POST",
          _path: "/login",
          _scenarios: [
            { _when: { "body.role": "admin" }, _response: { _status: 200 } },
          ],
          _otherwise: { _status: 401 },
        },
      ],
    });
    expect(issues).toEqual([]);
  });
});

describe("validateRoutes — bare top-level keys", () => {
  it("flags `method` and suggests `_method`", () => {
    const issues = parse({ _routes: [{ method: "GET", _path: "/x" }] });
    expect(issues).toHaveLength(1);
    expect(issues[0].token).toBe("method");
    expect(issues[0].message).toContain("`_method`");
  });

  it("flags `path` and suggests `_path`", () => {
    const issues = parse({ _routes: [{ _method: "GET", path: "/x" }] });
    expect(issues[0].token).toBe("path");
    expect(issues[0].message).toContain("`_path`");
  });

  it("flags multiple bare keys in the same entry", () => {
    const issues = parse({
      _routes: [{ method: "POST", path: "/login", handler: "login" }],
    });
    const tokens = issues.map((i) => i.token);
    expect(tokens).toContain("method");
    expect(tokens).toContain("path");
    expect(tokens).toContain("handler");
  });

  it("flags `response`, `scenarios`, `otherwise`, `delay`, `error`, `errorBody`", () => {
    const issues = parse({
      _routes: [
        {
          _method: "POST",
          _path: "/x",
          response: {},
          scenarios: [],
          otherwise: {},
          delay: 200,
          error: 503,
          errorBody: {},
        },
      ],
    });
    const tokens = issues.map((i) => i.token);
    expect(tokens).toContain("response");
    expect(tokens).toContain("scenarios");
    expect(tokens).toContain("otherwise");
    expect(tokens).toContain("delay");
    expect(tokens).toContain("error");
    expect(tokens).toContain("errorBody");
  });
});

describe("validateRoutes — bare keys inside response blocks", () => {
  it("flags `status` inside `_response`", () => {
    const issues = parse({
      _routes: [{ _method: "GET", _path: "/x", _response: { status: 200 } }],
    });
    expect(issues[0].token).toBe("status");
    expect(issues[0].message).toContain("`_status`");
  });

  it("flags `body` and `headers` inside `_response`", () => {
    const issues = parse({
      _routes: [
        {
          _method: "GET",
          _path: "/x",
          _response: { body: { ok: true }, headers: { "X-Foo": "bar" } },
        },
      ],
    });
    const tokens = issues.map((i) => i.token);
    expect(tokens).toContain("body");
    expect(tokens).toContain("headers");
  });

  it("flags bare keys inside `_otherwise` too", () => {
    const issues = parse({
      _routes: [
        {
          _method: "POST",
          _path: "/x",
          _otherwise: { status: 401, body: { error: "nope" } },
        },
      ],
    });
    const tokens = issues.map((i) => i.token);
    expect(tokens).toContain("status");
    expect(tokens).toContain("body");
  });
});

describe("validateRoutes — bare keys inside _scenarios entries", () => {
  it("flags `when` inside a _scenarios entry", () => {
    const issues = parse({
      _routes: [
        {
          _method: "POST",
          _path: "/x",
          _scenarios: [
            { when: { "body.role": "admin" }, _response: { _status: 200 } },
          ],
        },
      ],
    });
    expect(issues[0].token).toBe("when");
    expect(issues[0].message).toContain("`_when`");
  });

  it("flags `response` inside a _scenarios entry", () => {
    const issues = parse({
      _routes: [
        {
          _method: "POST",
          _path: "/x",
          _scenarios: [
            { _when: { "body.role": "admin" }, response: { _status: 200 } },
          ],
        },
      ],
    });
    expect(issues[0].token).toBe("response");
    expect(issues[0].message).toContain("`_response`");
  });

  it("accumulates issues across multiple entries and scenarios", () => {
    const issues = parse({
      _routes: [
        { method: "GET", path: "/a" },
        {
          _method: "POST",
          _path: "/b",
          _scenarios: [{ when: {}, response: {} }],
        },
      ],
    });
    const tokens = issues.map((i) => i.token);
    expect(tokens).toContain("method");
    expect(tokens).toContain("path");
    expect(tokens).toContain("when");
    expect(tokens).toContain("response");
  });
});

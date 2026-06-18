import { describe, it, expect } from "vitest";
import {
  extractCollections,
  validateRelations,
} from "../src/validator/validate.js";

// ─── extractCollections ───────────────────────────────────────────────────────

describe("extractCollections", () => {
  it("returns array-valued non-reserved keys", () => {
    const data = {
      users: [{ id: 1 }],
      posts: [{ id: 1 }],
    };
    expect(extractCollections(data)).toEqual(["users", "posts"]);
  });

  it("excludes reserved keys even when they are arrays", () => {
    const data = {
      users: [{ id: 1 }],
      _routes: [{ method: "GET", path: "/x" }],
      _rel: {},
      _schema: {},
    };
    expect(extractCollections(data)).toEqual(["users"]);
  });

  it("excludes non-array values", () => {
    const data = {
      users: [{ id: 1 }],
      title: "not a collection",
      count: 42,
    };
    expect(extractCollections(data)).toEqual(["users"]);
  });

  it("returns empty array when no collections exist", () => {
    expect(extractCollections({ _rel: {}, _routes: [] })).toEqual([]);
  });
});

// ─── validateRelations ────────────────────────────────────────────────────────

describe("validateRelations", () => {
  it("returns no issues when _rel is absent", () => {
    const data = { users: [] };
    expect(validateRelations(data, ["users"])).toEqual([]);
  });

  it("returns an issue when _rel is not an object", () => {
    const data = { _rel: "invalid", users: [] };
    const issues = validateRelations(data, ["users"]);
    expect(issues).toHaveLength(1);
    expect(issues[0].token).toBe("_rel");
  });

  it("returns an issue when entity is not a root collection", () => {
    const data = { _rel: { ghosts: { userId: "users" } }, users: [] };
    const issues = validateRelations(data, ["users"]);
    expect(issues).toHaveLength(1);
    expect(issues[0].token).toBe("ghosts");
    expect(issues[0].message).toContain('"ghosts" is not a root collection');
  });

  // ── Shorthand string ─────────────────────────────────────────────────────

  describe("shorthand string", () => {
    it("passes when target is a known collection", () => {
      const data = {
        _rel: { posts: { userId: "users" } },
        users: [],
        posts: [],
      };
      expect(validateRelations(data, ["users", "posts"])).toEqual([]);
    });

    it("returns an issue when target is unknown", () => {
      const data = { _rel: { posts: { userId: "ghosts" } }, posts: [] };
      const issues = validateRelations(data, ["posts"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].token).toBe("ghosts");
      expect(issues[0].message).toContain('"ghosts" is not a root collection');
    });
  });

  // ── DSL string ───────────────────────────────────────────────────────────

  describe("DSL string", () => {
    it("passes for a valid m2o DSL string", () => {
      const data = {
        _rel: { posts: { userId: "m2o:users[1..1->0..n]" } },
        users: [],
        posts: [],
      };
      expect(validateRelations(data, ["users", "posts"])).toEqual([]);
    });

    it("passes for a DSL string with +nested", () => {
      const data = {
        _rel: { posts: { userId: "m2o:users[1..1->0..n]+nested" } },
        users: [],
        posts: [],
      };
      expect(validateRelations(data, ["users", "posts"])).toEqual([]);
    });

    it("passes for a m2m DSL string with pivot", () => {
      const data = {
        _rel: {
          posts: { tags: "m2m:tags@post_tags(postId,tagId)[0..n->0..n]" },
        },
        posts: [],
        tags: [],
        post_tags: [],
      };
      expect(validateRelations(data, ["posts", "tags", "post_tags"])).toEqual(
        [],
      );
    });

    it("returns an issue when DSL target is unknown", () => {
      const data = {
        _rel: { posts: { userId: "m2o:ghosts[1..1->0..n]" } },
        posts: [],
      };
      const issues = validateRelations(data, ["posts"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].token).toBe("ghosts");
      expect(issues[0].message).toContain(
        'DSL target "ghosts" is not a root collection',
      );
    });
  });

  // ── Verbose object ───────────────────────────────────────────────────────

  describe("verbose object", () => {
    it("passes for a valid verbose relation", () => {
      const data = {
        _rel: { posts: { userId: { _type: "many2one", _target: "users" } } },
        users: [],
        posts: [],
      };
      expect(validateRelations(data, ["users", "posts"])).toEqual([]);
    });

    it("returns an issue when _type is missing", () => {
      const data = {
        _rel: { posts: { userId: { _target: "users" } } },
        users: [],
        posts: [],
      };
      const issues = validateRelations(data, ["users", "posts"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("missing _type");
    });

    it("returns an issue when _target is missing", () => {
      const data = {
        _rel: { posts: { userId: { _type: "many2one" } } },
        users: [],
        posts: [],
      };
      const issues = validateRelations(data, ["users", "posts"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain("missing _target");
    });

    it("returns an issue for an invalid _type", () => {
      const data = {
        _rel: { posts: { userId: { _type: "typo", _target: "users" } } },
        users: [],
        posts: [],
      };
      const issues = validateRelations(data, ["users", "posts"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].token).toBe("typo");
      expect(issues[0].message).toContain("Invalid relation type");
    });

    it("accepts all valid _type aliases", () => {
      const aliases = [
        "many2one",
        "m2o",
        "one2one",
        "o2o",
        "many2many",
        "m2m",
        "one2many",
        "o2m",
      ];
      for (const alias of aliases) {
        const data = {
          _rel: { posts: { userId: { _type: alias, _target: "users" } } },
          users: [],
          posts: [],
        };
        expect(validateRelations(data, ["users", "posts"])).toEqual([]);
      }
    });

    it("returns an issue when _target is an unknown collection", () => {
      const data = {
        _rel: { posts: { userId: { _type: "many2one", _target: "ghosts" } } },
        users: [],
        posts: [],
      };
      const issues = validateRelations(data, ["users", "posts"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].token).toBe("ghosts");
    });

    it("passes with valid cardinality values", () => {
      const data = {
        _rel: {
          posts: {
            userId: {
              _type: "many2one",
              _target: "users",
              "_car-direct": "1..1",
              "_car-inverse": "0..n",
            },
          },
        },
        users: [],
        posts: [],
      };
      expect(validateRelations(data, ["users", "posts"])).toEqual([]);
    });

    it("returns an issue for an invalid _car-direct value", () => {
      const data = {
        _rel: {
          posts: {
            userId: {
              _type: "many2one",
              _target: "users",
              "_car-direct": "2..5",
            },
          },
        },
        users: [],
        posts: [],
      };
      const issues = validateRelations(data, ["users", "posts"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].token).toBe("2..5");
      expect(issues[0].message).toContain("Invalid cardinality");
    });

    it("returns an issue for an invalid _car-inverse value", () => {
      const data = {
        _rel: {
          posts: {
            userId: {
              _type: "many2one",
              _target: "users",
              "_car-inverse": "many",
            },
          },
        },
        users: [],
        posts: [],
      };
      const issues = validateRelations(data, ["users", "posts"]);
      expect(issues).toHaveLength(1);
      expect(issues[0].token).toBe("many");
    });

    it("returns multiple issues when both _type and _target are invalid", () => {
      const data = {
        _rel: { posts: { userId: { _type: "typo", _target: "ghosts" } } },
        users: [],
        posts: [],
      };
      const issues = validateRelations(data, ["users", "posts"]);
      expect(issues).toHaveLength(2);
    });
  });
});

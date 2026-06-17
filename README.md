# YRest Language Support

VS Code extension for [yrest](https://github.com/aggiovato/yaml-rest) — the zero-config YAML-based REST API mock server.

Provides syntax highlighting, diagnostics and autocompletion for `db.yml` and `*.yrest.yml` files.

---

## Features

### Syntax highlighting

Highlights yrest-specific constructs on top of standard YAML:

| Token | Example | Color role |
|---|---|---|
| Reserved keys | `_rel`, `_routes`, `_schema`, `_type`, `_target` | `keyword.control` |
| Relation types | `many2one`, `one2one`, `many2many` | `storage.type` |
| DSL type alias | `m2o`, `o2o`, `m2m` inside a string | `keyword.other` |
| DSL target | collection name after `:` in DSL string | `entity.name.type` |
| DSL foreign key | field after `@` in DSL string | `variable.other` |
| Cardinality | `1..1`, `0..n`, `1..n`, `0..1` | `constant.numeric` |
| `+nested` flag | suffix in DSL string | `keyword.control` |
| Template variables | `{{params.id}}`, `{{now}}`, `{{uuid}}` | `variable.other` |
| Path parameters | `:id`, `:slug` in `_routes` paths | `variable.other` |

Injections are also active in plain `.yaml` files and inside TypeScript/JavaScript (e.g. test setup files using `yrest`).

### Diagnostics

Validates on every save and keystroke:

- **YAML syntax errors** — with exact position from the `yaml` parser
- **`_rel` entity names** must match a root collection in the same file
- **Relation targets** (shorthand string or `_target`) must match a root collection
- **`_type`** must be `many2one`, `one2one`, `many2many` (or aliases `m2o`, `o2o`, `m2m`)
- **`_car-direct` / `_car-inverse`** must use `0..1`, `1..1`, `1..n` or `0..n`
- **DSL strings** are validated against the full compact format regex

---

## Supported files

The extension activates automatically for:

| Pattern | How |
|---|---|
| `db.yml`, `db.yaml` | By filename |
| `*.yrest.yml`, `*.yrest.yaml` | By extension |

For any other filename, add to your VS Code settings:

```json
"files.associations": { "mock.yml": "yrest" }
```

---

## Syntax quick reference

### Shorthand relation (level 1)

```yaml
_rel:
  posts:
    userId: users
```

### Compact DSL (level 2 — type + cardinality)

```yaml
_rel:
  posts:
    userId: "m2o:users[1..1->0..n]"
    tags: "m2m:tags@post_tags(postId,tagId)[0..n->0..n]+nested"
```

### Verbose form (full control)

```yaml
_rel:
  payments:
    bookingId:
      _type: many2one
      _target: bookings
      _foreignKey: bookingId
      _car-direct: 1..1
      _car-inverse: 0..n
      _nested: true
```

### Custom routes with scenarios and template variables

```yaml
_routes:
  - method: POST
    path: /auth/login
    scenarios:
      - when:
          body.role: admin
        response:
          status: 200
          body:
            token: "{{uuid}}"
            generatedAt: "{{now}}"
    otherwise:
      status: 401
      body: { error: Invalid credentials }
    delay: 300

  - method: GET
    path: /orders/:id/receipt
    response:
      status: 200
      body:
        orderId: "{{params.id}}"
        issuedAt: "{{now}}"
```

---

## Requirements

- VS Code `^1.90.0`
- A `db.yml` file or any `*.yrest.yml` file following the [yrest YAML format](https://github.com/aggiovato/yaml-rest)

No additional runtime dependencies are needed. The extension bundles its own `yaml` parser.

---

## Roadmap

| Version | Features |
|---|---|
| **v0.1** (current) | Language support, syntax highlighting, diagnostics |
| **v0.2** | Hover docs for all reserved keys and relation types; autocomplete for `_type`, `_target`, cardinalities, collection names |
| **v0.3** | Smart validation via `@yrest/core`; quick fixes (convert shorthand → verbose, add missing `_type`/`_target`) |
| **v0.4** | `_routes` and `_schema` full support (highlighting, diagnostics, autocomplete) |
| **v1.0** | Language Server migration; go-to-collection, rename refactoring, cross-file analysis |

---

## License

MIT — [aggiovato](https://github.com/aggiovato)

# yRest Language Support

VS Code extension for [yrest](https://github.com/aggiovato/yaml-rest) — the zero-config YAML-based REST API mock server.

Provides syntax highlighting, hover documentation, autocompletion and diagnostics for `db.yml` and `*.yrest.yml` files.

---

## Features

### Syntax highlighting

Highlights yrest-specific constructs on top of standard YAML:

| Token              | Example                                          | Color role         |
| ------------------ | ------------------------------------------------ | ------------------ |
| Reserved keys      | `_rel`, `_routes`, `_schema`, `_type`, `_target` | `keyword.control`  |
| Relation types     | `many2one`, `one2one`, `many2many`               | `storage.type`     |
| DSL type alias     | `m2o`, `o2o`, `m2m` inside a string              | `keyword.other`    |
| DSL target         | collection name after `:` in DSL string          | `entity.name.type` |
| DSL foreign key    | field after `@` in DSL string                    | `variable.other`   |
| Cardinality        | `1..1`, `0..n`, `1..n`, `0..1`                   | `constant.numeric` |
| `+nested` flag     | suffix in DSL string                             | `keyword.control`  |
| Template variables | `{{params.id}}`, `{{now}}`, `{{uuid}}`           | `variable.other`   |
| Path parameters    | `:id`, `:slug` in `_routes` paths                | `variable.other`   |

Injections are also active in plain `.yaml` files and inside TypeScript/JavaScript (e.g. test setup files using `yrest`).

### Hover documentation

Hover any yrest reserved key, relation type, alias or cardinality to see inline docs with a description and a minimal YAML example.

Covered tokens: `_rel`, `_routes`, `_schema`, all `_rel` keys (`_type`, `_target`, `_foreignKey`, `_otherKey`, `_primaryKey`, `_through`, `_car-direct`, `_car-inverse`, `_nested`), all `_routes` keys (`_method`, `_path`, `_handler`, `_response`, `_scenarios`, `_otherwise`, `_delay`, `_error`, `_errorBody`), response block keys (`_status`, `_body`, `_headers`), `_when`, relation types and aliases (`many2one`, `m2o`, `one2one`, `o2o`, `many2many`, `m2m`), cardinalities and `+nested`.

Hover also works inside TypeScript/JavaScript tagged template literals:

```ts
const db = yrest`
  _rel:
    posts:
      userId: users   # hover works here too
`;
```

### Autocompletion

Context-aware completions trigger on `Space` and `:` — no `Ctrl+Space` needed:

| Context | Completions offered |
| --- | --- |
| `_type:` value | Relation types and aliases |
| `_target:` / `_through:` value | Collection names from the document |
| `_car-direct:` / `_car-inverse:` value | `1..1`, `0..1`, `1..n`, `0..n` |
| `_nested:` value | `true` / `false` |
| `_method:` value | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` |
| Key inside `_rel` object block | `_type`, `_target`, `_foreignKey`, `_through`, `_car-direct`, `_car-inverse`, `_nested`… |
| Shorthand relation value | Collection names from the document |
| Key inside `_routes` list entry | `_method`, `_path`, `_handler`, `_response`, `_scenarios`, `_otherwise`, `_delay`, `_error`, `_errorBody` |
| Key inside `_response` / `_otherwise` | `_status`, `_body`, `_headers` |
| Key inside `_scenarios` entry | `_when`, `_response` |

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

| Pattern                       | How          |
| ----------------------------- | ------------ |
| `db.yml`, `db.yaml`           | By filename  |
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
  - _method: POST
    _path: /auth/login
    _scenarios:
      - _when:
          body.role: admin
        _response:
          _status: 200
          _body:
            token: "{{uuid}}"
            generatedAt: "{{now}}"
    _otherwise:
      _status: 401
      _body: { error: Invalid credentials }
    _delay: 300

  - _method: GET
    _path: /orders/:id/receipt
    _response:
      _status: 200
      _body:
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

| Version            | Features                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **v0.1**           | Language support, syntax highlighting, diagnostics                                                                        |
| **v0.2** (current) | Hover docs for all reserved keys; autocomplete with 10 contexts; full `_routes` key support                               |
| **v0.3**           | Smart validation via `@yrest/core`; quick fixes (convert shorthand → verbose, add missing `_type`/`_target`)              |
| **v0.4**           | `_schema` support; diagnostics for `_routes` entries (`_method` valid value, `_path` format)                              |
| **v1.0**           | Language Server migration; go-to-collection, rename refactoring, cross-file analysis                                      |

---

## License

MIT — [aggiovato](https://github.com/aggiovato)

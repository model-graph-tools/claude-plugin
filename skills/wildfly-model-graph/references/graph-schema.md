# Graph Schema

Schema of the Neo4j graph database used to store the WildFly management model.
Extracted from WildFly 39. The same schema applies to all WildFly versions and feature packs.

## Node Labels

### Resource

A manageable element in the WildFly management model tree.

| Property | Type | Mandatory | Description |
|----------|------|-----------|-------------|
| name | STRING | yes | Resource type name (e.g., `data-source`, `server`) |
| address | STRING | yes | Full address path (e.g., `/subsystem=datasources/data-source=*`) |
| description | STRING | yes | Human-readable description |
| singleton | BOOLEAN | yes | Whether this resource type allows only a single instance |
| stability | STRING | yes | Stability level (e.g., `default`, `preview`, `experimental`) |
| child-descriptions | STRING | yes | JSON-encoded descriptions of child resource types |

### Attribute

A named configuration property on a resource.

| Property | Type | Mandatory | Description |
|----------|------|-----------|-------------|
| name | STRING | yes | Attribute name (e.g., `connection-url`, `max-pool-size`) |
| description | STRING | yes | Human-readable description |
| type | STRING | yes | Value type (`STRING`, `INT`, `LONG`, `BOOLEAN`, `LIST`, `OBJECT`, ...) |
| required | BOOLEAN | yes | Whether the attribute must be specified |
| nillable | BOOLEAN | yes | Whether the attribute accepts null values |
| expressions-allowed | BOOLEAN | yes | Whether expression values (e.g., `${env.VAR}`) are supported |
| stability | STRING | yes | Stability level |
| access-type | STRING | no | `read-write`, `read-only`, or `metric` |
| allowed | LIST\<STRING\> | no | Enumeration of allowed values |
| attribute-group | STRING | no | Logical grouping name |
| default-value | STRING | no | Default value (as string). In Cypher queries, use backtick escaping: `` a.`default-value` `` |
| max | INTEGER | no | Maximum numeric value |
| min | INTEGER | no | Minimum numeric value |
| max-length | INTEGER | no | Maximum string length |
| min-length | INTEGER | no | Minimum string length |
| restart-required | STRING | no | Restart level required after change (`no-services`, `all-services`, `jvm`) |
| storage | STRING | no | Storage type (`configuration`, `runtime`) |
| unit | STRING | no | Measurement unit (e.g., `MILLISECONDS`, `BYTES`) |
| value-type | STRING | no | For `LIST`/`OBJECT` types, describes the element type |

### Operation

A management action that can be invoked on a resource.

| Property | Type | Mandatory | Description |
|----------|------|-----------|-------------|
| name | STRING | yes | Operation name (e.g., `add`, `remove`, `test-connection-in-pool`) |
| description | STRING | yes | Human-readable description |
| global | BOOLEAN | yes | Whether this operation is available on all resources |
| read-only | BOOLEAN | yes | Whether this operation only reads state |
| runtime-only | BOOLEAN | yes | Whether this operation only affects runtime (not persisted config) |
| stability | STRING | yes | Stability level |
| return-value | STRING | no | Description of the return value type |
| value-type | STRING | no | For complex return types, describes the structure |

### Parameter

An input to an operation.

| Property | Type | Mandatory | Description |
|----------|------|-----------|-------------|
| name | STRING | yes | Parameter name |
| type | STRING | yes | Value type (`STRING`, `INT`, `BOOLEAN`, `LIST`, `OBJECT`, ...) |
| required | BOOLEAN | yes | Whether the parameter must be provided |
| nillable | BOOLEAN | yes | Whether the parameter accepts null values |
| expressions-allowed | BOOLEAN | yes | Whether expression values are supported |
| stability | STRING | yes | Stability level |
| allowed | LIST\<STRING\> | no | Enumeration of allowed values |
| max | INTEGER | no | Maximum numeric value |
| min | INTEGER | no | Minimum numeric value |
| max-length | INTEGER | no | Maximum string length |
| min-length | INTEGER | no | Minimum string length |
| unit | STRING | no | Measurement unit |
| value-type | STRING | no | For `LIST`/`OBJECT` types, describes the element type |

### Capability

A service contract that a resource declares or references.

| Property | Type | Mandatory | Description |
|----------|------|-----------|-------------|
| name | STRING | yes | Capability name (e.g., `org.wildfly.data-source`) |
| stability | STRING | no | Stability level |

### Version

A management model version used to track deprecation. These versions refer to the
**management model version**, not the WildFly server version. The management model
has its own versioning scheme that evolves independently from WildFly releases.

| Property | Type | Mandatory | Description |
|----------|------|-----------|-------------|
| major | INTEGER | yes | Major version number |
| minor | INTEGER | yes | Minor version number |
| patch | INTEGER | yes | Patch version number |
| ordinal | INTEGER | yes | Numeric ordinal for sorting (e.g., `390` for 39.0.0) |

### Constraint

A security constraint applied to sensitive attributes.

| Property | Type | Mandatory | Description |
|----------|------|-----------|-------------|
| name | STRING | yes | Constraint name |
| type | STRING | yes | Constraint type |

### Identity

Metadata about the source (one per database).

| Property | Type | Mandatory | Description |
|----------|------|-----------|-------------|
| name | STRING | yes | Source name (e.g., `WildFly 39.0`) |
| identifier | STRING | yes | Source identifier (e.g., `39.0`) |
| type | STRING | yes | Source type (`wildfly` or `feature-pack`) |
| version | STRING | yes | Full version string |
| group-id | STRING | yes | Maven group ID |
| artifact-id | STRING | yes | Maven artifact ID |
| description | STRING | yes | Source description |
| url | STRING | yes | Project URL |
| scm-url | STRING | yes | Source repository URL |
| licenses | STRING | yes | License information |

## Relationships

### Resource relationships

| Relationship | From | To | Properties | Description |
|-------------|------|-----|------------|-------------|
| `CHILD_OF` | Resource | Resource | — | Parent-child hierarchy in the resource tree |
| `HAS_ATTRIBUTE` | Resource | Attribute | — | Resource owns this attribute |
| `PROVIDES` | Resource | Operation | — | Resource exposes this operation |
| `DECLARES_CAPABILITY` | Resource | Capability | — | Resource declares (provides) this capability |
| `DEPRECATED_SINCE` | Resource | Version | `reason` (STRING) | Resource deprecated since this version, with reason |

### Attribute relationships

| Relationship | From | To | Properties | Description |
|-------------|------|-----|------------|-------------|
| `REFERENCES_CAPABILITY` | Attribute | Capability | — | Attribute value references this capability |
| `REQUIRES` | Attribute | Attribute | — | Attribute depends on another attribute |
| `ALTERNATIVE` | Attribute | Attribute | — | Attribute is mutually exclusive with another |
| `CONSISTS_OF` | Attribute | Attribute | — | Complex attribute composed of sub-attributes |
| `IS_SENSITIVE` | Attribute | Constraint | — | Attribute is marked as security-sensitive |
| `DEPRECATED_SINCE` | Attribute | Version | `reason` (STRING) | Attribute deprecated since this version |

### Operation relationships

| Relationship | From | To | Properties | Description |
|-------------|------|-----|------------|-------------|
| `ACCEPTS` | Operation | Parameter | — | Operation accepts this parameter |
| `DEPRECATED_SINCE` | Operation | Version | `reason` (STRING) | Operation deprecated since this version |

### Parameter relationships

| Relationship | From | To | Properties | Description |
|-------------|------|-----|------------|-------------|
| `REFERENCES_CAPABILITY` | Parameter | Capability | — | Parameter value references this capability |
| `REQUIRES` | Parameter | Parameter | — | Parameter depends on another parameter |
| `ALTERNATIVE` | Parameter | Parameter | — | Parameter is mutually exclusive with another |
| `CONSISTS_OF` | Parameter | Parameter | — | Complex parameter composed of sub-parameters |
| `DEPRECATED_SINCE` | Parameter | Version | `reason` (STRING) | Parameter deprecated since this version |

## Node Counts (WildFly 39)

| Label | Count |
|-------|-------|
| Resource | 839 |
| Attribute | 7,476 |
| Operation | 2,093 |
| Parameter | 7,016 |
| Capability | 262 |
| Constraint | 456 |
| Version | 23 |
| Identity | 1 |

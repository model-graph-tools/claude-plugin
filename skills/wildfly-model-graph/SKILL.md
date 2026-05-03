---
name: wildfly-model-graph
description: >
  This skill should be used when the user asks about the WildFly management
  model, WildFly subsystems, JBoss configuration, management resources,
  attributes, operations, capabilities, or stability levels. Covers queries
  like "what versions of WildFly are available", "show me the datasources
  subsystem", "what operations can I do on a datasource", "what changed
  between WildFly 38 and 39", "find deprecated attributes", "what
  capabilities does elytron provide", "start the model graph for WildFly
  39", "search for logging resources", "compare feature packs", "show model
  statistics", "what experimental features exist", "explore WildFly
  configuration", or "run a custom query against the model".
  Also applies when the user mentions specific WildFly subsystems such as
  undertow, elytron, datasources, messaging, infinispan, or logging in a
  management model context.
---

## Domain Knowledge

### What is the WildFly management model?

WildFly (formerly JBoss AS) exposes its entire configuration and runtime state through a
management model. Every configurable aspect — datasources, logging, security, web server,
messaging, clustering — is represented as a tree of **resources**, each with **attributes**
(configuration properties), **operations** (management actions), and **capabilities**
(services the resource provides or requires).

### Key concepts

- **Resource**: A manageable element identified by an address like `/subsystem=datasources`
  or `/subsystem=undertow/server=default-server/host=default-host`. Resources form a tree
  via parent-child relationships.

- **Attribute**: A named property on a resource (e.g., `connection-url`, `enabled`,
  `max-pool-size`). Has a type (STRING, INT, BOOLEAN, LIST, OBJECT, ...), may have a
  default value, and may be deprecated.

- **Operation**: An action that can be invoked on a resource (e.g., `add`, `remove`,
  `test-connection-in-pool`, `reload`). Operations accept **parameters** and may return
  results. Some operations are global (available on all resources), others are resource-specific.

- **Parameter**: An input to an operation. Has a name, type, and may be required or optional.

- **Capability**: A service contract that a resource declares (provides) or references
  (consumes). For example, a datasource resource declares a `org.wildfly.data-source`
  capability and references a `org.wildfly.data-sources.driver` capability. Capabilities
  enable WildFly's dependency management between subsystems.

- **Stability**: Resources, attributes, and operations have a stability level indicating
  their maturity: `default` (stable, recommended), `community` (community-contributed,
  less tested), `preview` (early access, may change), or `experimental` (highly unstable,
  for testing only). Most elements are `default`. Non-default stability levels signal that
  the feature may change or be removed in future versions. Use `find_by_stability` to
  discover non-default elements, or `get_statistics` for a stability breakdown.

- **Deprecation**: Resources, attributes, and operations can be deprecated starting from a
  specific WildFly version, with a reason explaining why and what to use instead.

### Model graphs: WildFly versions and feature packs

There are model graphs for two types of products:

- **WildFly versions**: The full management model of a WildFly standalone server
  (e.g., WildFly 34, 39). Identified by version number (`34`, `39`, `26.1`).

- **Feature packs**: Additional WildFly subsystems distributed as Galleon feature packs
  (e.g., `ai`, `graphql`). These provide focused management model extensions without the
  full WildFly server. Identified by `shortcut:version` (e.g., `ai:0.9.1`, `graphql:2.7.0`)
  for a specific version, or just the shortcut (e.g., `ai`) for the latest version.

Both types produce the same graph schema — the same query tools work for both.
When the user asks about a feature pack without specifying a version, use just the shortcut
(e.g., `"ai"`). When a specific version is needed, use `shortcut:version` (e.g., `"ai:0.9.1"`).

### Resource address format

Addresses use the pattern: `/<type>=<name>/<type>=<name>/...`

Examples:
- `/subsystem=datasources` — the datasources subsystem
- `/subsystem=datasources/data-source=ExampleDS` — a specific datasource
- `/subsystem=undertow/server=default-server/host=default-host` — a virtual host
- `/subsystem=logging/logger=com.example` — a logger category
- `/socket-binding-group=standard-sockets/socket-binding=http` — a socket binding

### Common subsystems

Users often ask about these areas:
- `datasources` — database connections (data-source, xa-data-source, jdbc-driver)
- `undertow` — web server (server, host, listener, filter, servlet-container)
- `logging` — log categories, handlers, formatters
- `elytron` — security (realms, domains, factories, SASL, TLS)
- `messaging-activemq` — JMS queues, topics, connection factories
- `infinispan` — caching (cache-container, distributed-cache, replicated-cache)
- `jpa` — JPA/Hibernate configuration
- `ejb3` — EJB container settings
- `batch-jberet` — batch processing (JSR 352)
- `ee` — Java EE platform settings

## How to use the tools

**CRITICAL RULE:** Never read cached tool-result JSON files from disk (`cat ...tool-results/*.json`),
and never pipe MCP tool output through `python3`, `jq`, or any Bash post-processing. All MCP tool
responses are structured — summarize directly from the tool response. If the response is too large,
use `run_cypher` with a targeted query instead of trying to parse a large `browse_resource` result.

### Translating user intent

| User says...                                        | Tool to use            | Key parameters                              |
|-----------------------------------------------------|------------------------|----------------------------------------------|
| "what versions are available?"                      | `list_sources`         | (none)                                       |
| "what feature packs are there?"                     | `list_sources`         | (none)                                       |
| "start the model graph for WildFly 39"              | `start_source`         | identifier="39"                              |
| "start the model graph for the AI feature pack"     | `start_source`         | identifier="ai" (latest) or "ai:0.9.1"       |
| "stop the model graph for WildFly 38"               | `stop_source`          | identifier="38"                              |
| "find resources for datasources"                    | `search_resources`     | query="datasource"                           |
| "show me the undertow subsystem"                    | `browse_resource`      | address="/subsystem=undertow"                |
| "what operations can I do on a datasource?"         | `search_resources` then `browse_resource` | query="data-source", then browse a concrete result |
| "how do I add a datasource?"                        | `describe_resource`    | address="/subsystem=datasources/data-source=*" — returns markdown with required params, attributes, and CLI example |
| "is there an operation to test my DB connection?"   | `search_operations`    | query="test connection"                      |
| "what attributes are deprecated in logging?"        | `search_attributes`    | query="logging", deprecated=true             |
| "what capabilities does the datasource declare?"    | `find_capabilities`    | query="data-source"                          |
| "what's new in WildFly 39?"                         | `compare_versions`     | identifier1="38", identifier2="39"           |
| "show all deprecated stuff since WildFly 30"        | `find_deprecated`      | since_version="30.0.0"                       |
| "what experimental features are in WildFly 39?"     | `find_by_stability`    | stability="experimental"                     |
| "show preview attributes"                           | `find_by_stability`    | stability="preview", element_type="attribute"|
| "find community stability attributes for logging"   | `search_attributes`    | query="logging", stability="community"       |
| "give me an overview of the model"                  | `get_statistics`       | (identifier only)                            |
| "how many resources does WildFly 39 have?"          | `get_statistics`       | identifier="39"                              |
| "what attributes changed between WildFly 38 and 39?"| `compare_versions`     | identifier1="38", identifier2="39"           |
| "what resources does the AI feature pack have?"      | `search_resources`     | identifier="ai" or "ai:0.9.1", query=""      |
| "run a custom query against the model"              | `run_cypher`           | query="MATCH ...", identifier="39"           |

When the user asks "what's new in WildFly X" or "what changed in WildFly X" without
specifying a base version, infer the previous version: call `list_sources` to get
available versions, then pick the highest version below X. For example, if X is 39
and available versions include 34, 36, 38, 39, use 38 as identifier1.

### Starting and stopping model graphs

Each model graph runs as a database — one per WildFly version or feature pack. They are
managed by the `mgt` CLI tool. Before querying a model graph, it must be running.

**Important wording:** When talking about starting or stopping, always say you are
starting/stopping the **model graph**, not WildFly itself or the feature pack. WildFly is the
application server whose management model is stored in the model graph. A feature pack is a
build-time extension of WildFly — it cannot be "started" or "stopped" either. What starts and
stops is the model graph database holding the data.

**Startup timing:** Starting a model graph may take up to a minute, especially on first use
when the container image needs to be downloaded. Before calling `start_source`, tell the user
that starting the model graph may take a moment. If the image is being pulled for the first
time, mention that this is a one-time download. Example: "I'll start the model graph for
WildFly 39. This may take a moment — on first use, the data needs to be downloaded."

Follow this pattern:

1. If any query tool returns a "not running" error, suggest using `start_source`
2. Before `compare_versions`, check that both model graphs are running (use `list_sources`)
3. If `start_source` fails because the data isn't available locally, tell the user they may
   need to run `mgt analyze` first
4. Don't stop model graphs unless the user asks — they persist across sessions and are cheap
   to keep running
5. If `start_source` or `stop_source` returns an error about `mgt` not being found, tell
   the user to install it from https://github.com/model-graph-tools/tooling
6. If `start_source` times out, suggest the user check that Docker is running and has network
   access. If Docker is running but the pull is slow, they can retry — the download resumes
   from where it left off
7. If `start_source` fails with a Docker-related error (not running, permission denied, disk
   full), relay the specific error and suggest the corrective action

### Handling wildcard addresses

When browsing a resource that is a named instance (like a specific datasource), and the user
hasn't specified a name, use `search_resources` first to find available instances, then
`browse_resource` with a concrete address. For example, if the user asks about "datasource
attributes", first search for datasource resources to find the address pattern, then browse
a representative resource at the wildcard level.

### Configuration how-to questions

When the user asks "how do I add X?", "how do I configure X?", or "what do I need for X?",
use the `describe_resource` tool. It returns a concise, human-readable markdown summary with
required parameters, attributes, and a CLI example — no JSON parsing needed.

1. Use `search_resources` to find the resource address (if not already known).
2. Call `describe_resource` with the resource address.
3. Present the markdown response to the user. Supplement with additional context if helpful
   (e.g., mention related operations like `test-connection-in-pool` for datasources).

**Do NOT use `browse_resource` for how-to questions** — its response is too large and
contains more detail than needed. Use `describe_resource` instead.

### Selecting the right model graph

- Always call `list_sources` at the start of a session or when the user references a model
  graph you're unsure about. The response includes an `activeSource` field that shows which
  model graph was last queried, and each entry has an `active` flag.
- If the user asks **"what model am I using?"**, **"what's the current model graph?"**, or
  similar, call `list_sources` and report the `activeSource`. If none is active, say so.
- If the user **specifies a version or feature pack**, map it to the tool's `identifier`
  parameter (e.g., "WildFly 39" → `"39"`, "the AI feature pack" → `"ai"`,
  "AI feature pack 0.9.1" → `"ai:0.9.1"`).
- If the user **does not specify a model graph**, pick one using this priority:
  1. If there is an active model graph (from a previous query in this session), keep using it.
  2. If exactly one model graph is already running, use it.
  3. If multiple model graphs are running, prefer the latest WildFly version among them.
  4. If no model graph is running, start the latest available WildFly version.
  5. If the context is clearly about a feature pack (e.g., "AI subsystem"), prefer a running
     feature pack model graph over a WildFly version.
- When comparing versions, the user might say "WildFly 39" — pass `"39"` as the tool's
  `identifier` parameter.
- Feature packs use the format `shortcut:version` (e.g., `"ai:0.9.1"`,
  `"graphql:2.7.0"`). Use just the shortcut (e.g., `"ai"`) to target the latest version.

### Response formatting

When presenting results:

- **Resource addresses**: Format as inline code: `/subsystem=datasources/data-source=ExampleDS`
- **Attribute tables**: Show name, type, and description. Include default value and
  deprecation info when relevant.
- **Operation results**: Show the operation name, a brief description, and list required
  parameters. Mark optional parameters separately.
- **Deprecation info**: Always show the version it was deprecated in and the reason.
- **Model graph context**: When showing results, mention which model graph (WildFly version or
  feature pack) the data comes from so the user has context.
- **Large result sets**: If there are many results, summarize the count and show the most
  relevant ones. Ask the user if they want to see more or narrow the search.

### Multi-step exploration

Many questions require multiple tool calls. For example:

1. "What resources are related to mail?" -> `search_resources` with query="mail"
2. User picks `/subsystem=mail` -> `browse_resource` to see full details
3. "Show me the deprecated attributes" -> `search_attributes` with query matching
   the resource, deprecated=true

Guide the user through this exploration naturally. After showing search results, suggest
browsing a specific resource. After browsing, point out interesting operations or capabilities.

## Limitations

- The graph database is read-only. You cannot modify the management model.
- Each model graph (WildFly version or feature pack) is a separate database.
  Cross-graph queries (except `compare_versions`) require multiple tool calls.
- The `run_cypher` tool is available for advanced queries but results are raw JSON.
  Use structured tools first. See `references/cypher-queries.md` for example queries.
- Very broad queries (e.g., "all attributes") may hit result limits. Help the user
  narrow their search.
- Cross-type comparisons (comparing a WildFly version with a feature pack) are not supported
  by `compare_versions`. Both entries should be of the same type.

# mgt Claude Code Plugin

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin for exploring the WildFly management model via natural language. Query resources, attributes, operations, capabilities, and deprecations across WildFly versions and feature packs — all backed by Neo4j graph databases.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- [mgt](https://github.com/model-graph-tools/tooling) CLI installed and on PATH
- Docker or Podman for running Neo4j containers
- Node.js 20+

## Installation

### From marketplace

```bash
claude plugin marketplace add https://github.com/model-graph-tools/claude-plugin
claude plugin install mgt@model-graph-tools
```

### Local development

```bash
git clone https://github.com/model-graph-tools/claude-plugin.git
cd claude-plugin/mcp-server && npm install && npm run build
claude --plugin-dir /path/to/claude-plugin
```

## Usage

Use the `/mgt:model` command or ask questions naturally — the skill activates automatically when Claude detects WildFly management model context.

```
/mgt:model what resources does the datasources subsystem have?
/mgt:model compare WildFly 38 and 39
/mgt:model show deprecated attributes in the logging subsystem
/mgt:model what capabilities does elytron declare?
/mgt:model start the AI feature pack
```

## MCP Tools

| Tool | Purpose |
|------|---------|
| `list_sources` | Lists available WildFly versions and feature packs with container status |
| `start_source` | Starts a Neo4j container for a source (auto-pulls image) |
| `stop_source` | Stops a running Neo4j container |
| `search_resources` | Searches resources by name or address pattern |
| `browse_resource` | Returns a resource with children, attributes, operations, capabilities |
| `search_operations` | Searches operations across all resources |
| `search_attributes` | Searches attributes, with optional deprecated-only filter |
| `find_capabilities` | Searches capabilities and their declaring/referencing resources |
| `find_deprecated` | Finds deprecated elements, filterable by version and type |
| `compare_versions` | Diffs two sources for added/removed/deprecated elements |
| `run_cypher` | Escape hatch: runs arbitrary read-only Cypher (100 row limit, 10s timeout) |

## How It Works

The plugin delegates container lifecycle to the `mgt` CLI, which manages Neo4j containers — one per WildFly version or feature pack. Each container holds a graph database with the full management model extracted by the [analyzer](https://github.com/model-graph-tools/analyzer). The MCP server connects to these containers via the Bolt protocol and runs Cypher queries through 11 purpose-built tools.

## Related Projects

- [model-graph-tools/tooling](https://github.com/model-graph-tools/tooling) — `mgt` CLI for container lifecycle and WildFly analysis
- [model-graph-tools/analyzer](https://github.com/model-graph-tools/analyzer) — Extracts the management model and populates Neo4j

## License

[Apache License 2.0](LICENSE)

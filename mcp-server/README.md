# @model-graph-tools/mcp-server

An [MCP](https://modelcontextprotocol.io/) server for querying the [WildFly](https://wildfly.org) management model stored in Neo4j graph databases.

This package is the backend for the [Model Graph Tools Claude Code plugin](https://github.com/model-graph-tools/claude-plugin). It provides 11 tools for searching, browsing, and comparing the WildFly management model across versions and feature packs.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [`mgt`](https://github.com/model-graph-tools/tooling) CLI installed and on PATH
- [Docker](https://www.docker.com/) or [Podman](https://podman.io/) for running Neo4j containers

## Usage

This server is designed to be launched by the Claude Code plugin via `npx`. You don't normally run it directly — install the [plugin](https://github.com/model-graph-tools/claude-plugin) instead.

To run standalone (for development or debugging):

```bash
npx @model-graph-tools/mcp-server
```

The server communicates over stdio using the MCP protocol.

## Tools

| Tool | Description |
|------|-------------|
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
| `run_cypher` | Runs arbitrary read-only Cypher queries (100 row limit, 10s timeout) |

## Related Projects

| Project | Description |
|---------|-------------|
| [claude-plugin](https://github.com/model-graph-tools/claude-plugin) | Claude Code plugin (skill, command, and this MCP server) |
| [tooling](https://github.com/model-graph-tools/tooling) | `mgt` CLI for container lifecycle and WildFly analysis |
| [analyzer](https://github.com/model-graph-tools/analyzer) | Java tool that reads the WildFly management model and populates Neo4j |

## License

[Apache License 2.0](https://github.com/model-graph-tools/claude-plugin/blob/main/LICENSE)

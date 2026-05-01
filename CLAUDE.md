# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository is a **Claude Code plugin** for exploring the WildFly management model via natural language. The repo root is the plugin root.

## Repository Structure

```
skill/                           # Plugin root
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest (skills, mcpServers)
│   └── marketplace.json         # Marketplace manifest
├── skills/
│   └── wildfly-model-graph/
│       └── SKILL.md             # Skill prompt (domain knowledge, tool usage)
├── mcp-server/                  # MCP server (TypeScript, Node.js)
│   ├── src/
│   │   ├── index.ts             # Server entry point, tool registration
│   │   ├── neo4j.ts             # Neo4j driver/connection pool management
│   │   ├── mgt.ts               # mgt CLI wrapper (shell out to mgt --json)
│   │   └── tools/               # One file per MCP tool
│   ├── dist/                    # Compiled JS output
│   ├── package.json
│   └── tsconfig.json
└── CLAUDE.md
```

## Installation

```bash
# From marketplace
claude plugin marketplace add https://github.com/model-graph-tools/claude-plugin
claude plugin install mgt@model-graph-tools

# Local development/testing
claude --plugin-dir /path/to/claude-plugin
```

The MCP server is published to npm as [`@model-graph-tools/mcp-server`](https://www.npmjs.com/package/@model-graph-tools/mcp-server) and fetched via `npx` at runtime.

## Build & Run

```bash
# Build the MCP server
cd mcp-server && npm run build

# Run in development mode (tsx, no compile step)
cd mcp-server && npm run dev

# Start the compiled server
cd mcp-server && npm start
```

The MCP server communicates over stdio and is launched automatically by Claude Code when the plugin is installed.

## MCP Tools

13 tools registered in `src/index.ts`:

| Tool | Purpose |
|------|---------|
| `list_sources` | Lists available WildFly versions and feature packs with container status |
| `start_source` | Starts a Neo4j container for a source (auto-pulls image) |
| `stop_source` | Stops a running Neo4j container |
| `search_resources` | Searches resources by name or address pattern |
| `browse_resource` | Returns a resource with full metadata: description, stability, parent, children, attributes (with access-type, stability, required, nillable, expressions-allowed, storage), operations (with stability), parameter relationships (requires/alternatives), and capabilities |
| `search_operations` | Searches operations across all resources |
| `search_attributes` | Searches attributes, with optional deprecated-only and stability level filters |
| `find_capabilities` | Searches capabilities and their declaring/referencing resources |
| `find_deprecated` | Finds deprecated elements, filterable by version and type |
| `find_by_stability` | Finds elements by stability level (experimental, preview, community, default) |
| `get_statistics` | Overview of a source's model: counts, stability breakdown, relationships |
| `compare_versions` | Diffs two sources for added/removed/deprecated elements, including attribute and operation changes within shared resources |
| `run_cypher` | Escape hatch: runs arbitrary read-only Cypher (100 row limit, 10s timeout) |

## Key Architecture

- **`mgt` CLI delegation** — Container lifecycle (start/stop/ps/versions/feature-packs) is handled by shelling out to `mgt --json`. The `mgt.ts` module wraps these calls. `mgt` must be installed and on PATH.
- **One Neo4j container per source** — Each WildFly version or feature pack runs its own Neo4j instance. Cross-source queries (like `compare_versions`) connect to two containers simultaneously.
- **Connection pooling** — `neo4j.ts` manages a `Map<string, Driver>` of Neo4j connections, reusing drivers across tool calls. Tracks the active source for session continuity.
- **Zod schemas** — Tool input validation uses Zod v4.

## Domain

The WildFly management model is a tree of **resources** (e.g., `/subsystem=datasources/data-source=ExampleDS`), each with **attributes**, **operations** (with **parameters**), and **capabilities**. The model is extracted from running WildFly instances (or feature pack doc-zips) by the [analyzer](https://github.com/model-graph-tools/analyzer) and stored in Neo4j. Each source gets its own Neo4j database, shipped as a container image at `quay.io/modelgraphtools/model`.

Two source types:
- **WildFly versions** — identified by version number (e.g., `34`, `39`), image tag like `model:34.0.0.Final`
- **Feature packs** — identified by `shortcut:version` (e.g., `ai:0.9.1`, `graphql:2.7.0`), image tag like `model:ai-1.0.0`

## Graph Schema

Nodes: `Resource`, `Attribute`, `Operation`, `Parameter`, `Capability`, `Version`

Key relationships: `CHILD_OF`, `HAS_ATTRIBUTE`, `PROVIDES`, `ACCEPTS`, `DECLARES_CAPABILITY`, `REFERENCES_CAPABILITY`, `DEPRECATED_SINCE`, `REQUIRES`, `ALTERNATIVE`

## Dependencies

- `@modelcontextprotocol/server` — MCP server SDK
- `neo4j-driver` — Neo4j Bolt protocol driver
- `zod` — Input schema validation
- `tsx` (dev) — TypeScript execution for development

## Related Projects

- [model-graph-tools/tooling](https://github.com/model-graph-tools/tooling) (`mgt`) — Rust CLI that manages container lifecycle, analyzes WildFly instances and feature packs. Required runtime dependency.
- [model-graph-tools/analyzer](https://github.com/model-graph-tools/analyzer) — Java tool that reads the WildFly management model and populates Neo4j.

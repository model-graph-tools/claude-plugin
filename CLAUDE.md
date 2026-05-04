# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository provides an **MCP server** and **Agent Skill** for exploring the WildFly management model via natural language. It follows open standards ([MCP](https://modelcontextprotocol.io/) and [Agent Skills](https://agentskills.io/)) and works with any compatible AI agent — Claude Code, Gemini CLI, OpenAI Codex, VS Code/Copilot, Cursor, and others.

For Claude Code, the repo root doubles as a plugin root (see `.claude-plugin/`).

## Repository Structure

```
claude-plugin/                   # Plugin root
├── .claude-plugin/              # Claude Code plugin packaging
│   ├── plugin.json              # Plugin manifest (skills, mcpServers)
│   └── marketplace.json         # Marketplace manifest
├── skills/
│   └── wildfly-model-graph/
│       ├── SKILL.md             # Skill prompt (domain knowledge, tool usage)
│       └── references/          # Graph schema and Cypher query reference
├── commands/
│   └── model.md                 # /mgt:model slash command
├── mcp-server/                  # MCP server (TypeScript, Node.js)
│   ├── src/
│   │   ├── index.ts             # Server entry point, tool registration
│   │   ├── neo4j.ts             # Neo4j driver/connection pool management
│   │   ├── mgt.ts               # mgt CLI wrapper (shell out to mgt --json)
│   │   ├── session.ts           # Session state management
│   │   └── tools/               # One file per MCP tool (16 tools)
│   ├── dist/                    # Compiled JS output
│   ├── package.json
│   └── tsconfig.json
└── CLAUDE.md
```

## Installation

The MCP server is published to npm as [`@model-graph-tools/mcp-server`](https://www.npmjs.com/package/@model-graph-tools/mcp-server) and fetched via `npx` at runtime.

**Claude Code** (plugin):
```bash
claude plugin marketplace add https://github.com/model-graph-tools/claude-plugin
claude plugin install mgt@model-graph-tools
```

**Other agents** (MCP + skill): Configure `npx --yes @model-graph-tools/mcp-server` as an MCP server and copy `skills/wildfly-model-graph/` into your agent's skills folder. See the [README](README.md) for agent-specific setup.

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

16 tools registered in `src/index.ts`:

| Tool | Purpose |
|------|---------|
| `list_sources` | Lists available WildFly versions and feature packs with container status |
| `start_source` | Starts a Neo4j container for a model graph (auto-pulls image) |
| `stop_source` | Stops a running Neo4j container |
| `search_resources` | Searches resources by name, address, or description |
| `browse_resource` | Returns a resource with full metadata: description, stability, parent, children, attributes (with access-type, stability, required, nillable, expressions-allowed, storage, sub-attribute composition for complex types), operations (with stability), parameter relationships (requires/alternatives), and capabilities |
| `describe_resource` | Returns a concise, human-readable markdown description of a resource — purpose, required add-operation parameters, required and optional attributes, and a CLI example. Use for "how do I add/configure X?" questions |
| `search_operations` | Searches operations across all resources, includes stability and deprecation info |
| `search_attributes` | Searches attributes with optional deprecated-only and stability level filters, includes access type and required flag |
| `find_capabilities` | Searches capabilities and their declaring/referencing resources (via attributes and parameters) |
| `find_deprecated` | Finds deprecated elements (resources, attributes, operations, parameters), filterable by version and type |
| `find_by_stability` | Finds elements (resources, attributes, operations, parameters) by stability level (experimental, preview, community, default) |
| `get_statistics` | Overview of a model graph: identity metadata, counts, stability breakdown, relationships |
| `compare_versions` | Diffs two model graphs for added/removed/deprecated elements, including attribute, operation, and parameter changes within shared resources |
| `get_resource_tree` | Returns all resources in the subtree under a given address for hierarchy exploration |
| `find_relationships` | Shows REQUIRES (must be set together) and ALTERNATIVE (mutually exclusive) relationships between attributes and operation parameters |
| `run_cypher` | Escape hatch: runs arbitrary read-only Cypher (100 row limit, 10s timeout) |

## Key Architecture

- **`mgt` CLI delegation** — Container lifecycle (start/stop/ps/versions/feature-packs) is handled by shelling out to `mgt --json`. The `mgt.ts` module wraps these calls. `mgt` must be installed and on PATH.
- **One Neo4j container per model graph** — Each WildFly version or feature pack runs its own Neo4j instance. Cross-graph queries (like `compare_versions`) connect to two containers simultaneously.
- **Connection pooling** — `neo4j.ts` manages a `Map<string, Driver>` of Neo4j connections, reusing drivers across tool calls. Tracks the active model graph for session continuity.
- **Zod schemas** — Tool input validation uses Zod v4.

## Domain

The WildFly management model is a tree of **resources** (e.g., `/subsystem=datasources/data-source=ExampleDS`), each with **attributes**, **operations** (with **parameters**), and **capabilities**. The model is extracted from running WildFly instances (or feature pack doc-zips) by the [analyzer](https://github.com/model-graph-tools/analyzer) and stored in Neo4j. Each model graph gets its own Neo4j database, shipped as a container image at `quay.io/modelgraphtools/model`.

Two types of model graphs:
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

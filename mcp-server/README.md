# @model-graph-tools/mcp-server

An [MCP](https://modelcontextprotocol.io/) server for querying the [WildFly](https://wildfly.org) management model stored in Neo4j graph databases.

This package is part of the [Model Graph Tools](https://github.com/model-graph-tools/claude-plugin) project. It provides 16 tools for searching, browsing, and comparing the WildFly management model across versions and feature packs. It works with any AI agent that supports MCP — see [Platform Configuration](#platform-configuration) below.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [`mgt`](https://github.com/model-graph-tools/tooling) CLI installed and on PATH
- [Docker](https://www.docker.com/) or [Podman](https://podman.io/) for running Neo4j containers

## Usage

This server communicates over stdio using the MCP protocol. It is typically launched automatically by your AI agent — configure it as shown below.

To run standalone (for development or debugging):

```bash
npx @model-graph-tools/mcp-server
```

## Platform Configuration

### Claude Code

Install the [plugin](https://github.com/model-graph-tools/claude-plugin) — the MCP server is configured automatically:

```bash
claude plugin marketplace add https://github.com/model-graph-tools/claude-plugin
claude plugin install mgt@model-graph-tools
```

### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "wildfly-model-graph": {
      "command": "npx",
      "args": ["--yes", "@model-graph-tools/mcp-server"]
    }
  }
}
```

### OpenAI Codex

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.wildfly-model-graph]
command = "npx"
args = ["--yes", "@model-graph-tools/mcp-server"]
```

### VS Code / GitHub Copilot

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "wildfly-model-graph": {
      "command": "npx",
      "args": ["--yes", "@model-graph-tools/mcp-server"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wildfly-model-graph": {
      "command": "npx",
      "args": ["--yes", "@model-graph-tools/mcp-server"]
    }
  }
}
```

### Other Agents

For any MCP-compatible agent, configure it to run `npx --yes @model-graph-tools/mcp-server` over stdio. See the [main README](https://github.com/model-graph-tools/claude-plugin) for full setup instructions including the [Agent Skill](https://agentskills.io/) installation.

## Tools

| Tool | Description |
|------|-------------|
| `list_sources` | Lists available WildFly versions and feature packs with container status |
| `start_source` | Starts a Neo4j container for a source (auto-pulls image) |
| `stop_source` | Stops a running Neo4j container |
| `search_resources` | Searches resources by name or address pattern |
| `browse_resource` | Returns a resource with full metadata: description, stability, parent, children, attributes (with access-type, stability, required, nillable, expressions-allowed, storage), operations (with stability), parameter relationships (requires/alternatives), and capabilities |
| `describe_resource` | Returns a concise, human-readable description of a resource — purpose, required add-operation parameters, required and optional attributes, and a CLI example |
| `search_operations` | Searches operations across all resources |
| `search_attributes` | Searches attributes, with optional deprecated-only and stability level filters |
| `find_capabilities` | Searches capabilities and their declaring/referencing resources |
| `find_deprecated` | Finds deprecated elements, filterable by version and type |
| `find_by_stability` | Finds elements by stability level (experimental, preview, community, default) |
| `get_statistics` | Overview of a source's model: counts, stability breakdown, relationships |
| `compare_versions` | Diffs two sources for added/removed/deprecated elements, including attribute and operation changes within shared resources |
| `get_resource_tree` | Returns all resources in the subtree under a given address for hierarchy exploration |
| `find_relationships` | Shows REQUIRES and ALTERNATIVE relationships between attributes and operation parameters |
| `run_cypher` | Runs arbitrary read-only Cypher queries (100 row limit, 10s timeout) |

## Related Projects

| Project | Description |
|---------|-------------|
| [claude-plugin](https://github.com/model-graph-tools/claude-plugin) | Claude Code plugin (skill, command, and this MCP server) |
| [tooling](https://github.com/model-graph-tools/tooling) | `mgt` CLI for container lifecycle and WildFly analysis |
| [analyzer](https://github.com/model-graph-tools/analyzer) | Java tool that reads the WildFly management model and populates Neo4j |

## License

[Apache License 2.0](https://github.com/model-graph-tools/claude-plugin/blob/main/LICENSE)

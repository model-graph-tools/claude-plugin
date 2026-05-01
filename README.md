# Model Graph Tools Claude Code Plugin

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin for exploring the [WildFly](https://wildfly.org) management model via natural language.

WildFly exposes its entire configuration and runtime state through a management model — a tree of resources, each with attributes, operations, and capabilities. This plugin lets you search, browse, and compare that model across WildFly versions and feature packs, powered by Neo4j graph databases and the [`mgt`](https://github.com/model-graph-tools/tooling) CLI.

## What You Can Do

- **Search** resources, attributes, and operations by name or pattern
- **Browse** the resource tree with full attribute, operation, and capability details
- **Find** deprecated elements and track when they were deprecated
- **Compare** two WildFly versions to see what was added, removed, or deprecated
- **Explore** feature pack extensions (AI, GraphQL, etc.) using the same tools
- **Run** arbitrary read-only Cypher queries for advanced use cases

## Installation

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [`mgt`](https://github.com/model-graph-tools/tooling) CLI installed and on PATH
- [Docker](https://www.docker.com/) or [Podman](https://podman.io/) for running Neo4j containers
- [Node.js](https://nodejs.org/) 20+

### From Marketplace

```bash
claude plugin marketplace add https://github.com/model-graph-tools/claude-plugin
claude plugin install mgt@model-graph-tools
```

The MCP server is fetched automatically from [npm](https://www.npmjs.com/package/@model-graph-tools/mcp-server) via `npx` — no build step required.

### From Source

```bash
git clone https://github.com/model-graph-tools/claude-plugin.git
cd claude-plugin/mcp-server
npm install
npm run build
```

Then load the plugin locally:

```bash
claude --plugin-dir /path/to/claude-plugin
```

## Usage

### Slash Command

Use `/mgt:model` followed by your question:

```
/mgt:model How do I add a new datasource?
/mgt:model How does the logging subsystem work?
/mgt:model How does capabilities work?
/mgt:model What capabilities does elytron declare?
/mgt:model What is an authentication context?
/mgt:model Tell me more about credential stores.
/mgt:model Compare WildFly 38 and 39.
/mgt:model What resources does the AI feature pack provide?
/mgt:model Compare the first and the latest version of the AI feature pack.
```

### Natural Language

The skill also activates automatically when Claude detects WildFly management model context in your conversation — just ask about subsystems, resources, attributes, or operations naturally. So most of the questions above should also work without using the slash command.

### Container Lifecycle

Each WildFly version or feature pack runs as a separate Neo4j container. The plugin manages these through `mgt`:

- Containers are started on demand when you query a source
- If a source isn't running, the plugin will suggest starting it
- Containers started during a session are automatically stopped when the MCP server shuts down
- Containers started outside the session (e.g., via `mgt start`) persist and are not affected
- Stop containers explicitly at any time: `/mgt:model stop WildFly 39`

## Related Projects

This plugin is part of the [model-graph-tools](https://github.com/model-graph-tools) ecosystem:

| Project | Description |
|---------|-------------|
| [tooling](https://github.com/model-graph-tools/tooling) | `mgt` — Rust CLI that analyzes WildFly instances, builds Neo4j model images, and manages container lifecycle |
| [analyzer](https://github.com/model-graph-tools/analyzer) | Java tool that reads the WildFly management model and populates Neo4j |

## Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Build the MCP server: `cd mcp-server && npm install && npm run build`
4. Test locally: `claude --plugin-dir /path/to/your/fork`
5. Commit your changes using [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, etc.
6. Push and open a pull request

### Development Setup

```bash
git clone https://github.com/model-graph-tools/claude-plugin.git
cd claude-plugin/mcp-server
npm install
npm run dev    # runs with tsx, no compile step needed
```

### Project Structure

```
claude-plugin/
├── .claude-plugin/
│   ├── plugin.json              # Plugin manifest
│   └── marketplace.json         # Marketplace manifest
├── skills/
│   └── wildfly-model-graph/
│       └── SKILL.md             # Skill prompt with domain knowledge
├── commands/
│   └── model.md                 # /mgt:model slash command
├── mcp-server/
│   └── src/
│       ├── index.ts             # Server entry point, tool registration
│       ├── neo4j.ts             # Neo4j connection management
│       ├── mgt.ts               # mgt CLI wrapper
│       └── tools/               # One file per MCP tool (11 tools)
└── README.md
```

### Adding a New Tool

1. Create a new file in `mcp-server/src/tools/`
2. Implement the query function with a Neo4j session
3. Register the tool in `mcp-server/src/index.ts` with a Zod input schema
4. Update the skill prompt in `skills/wildfly-model-graph/SKILL.md` with usage guidance

## License

[Apache License 2.0](LICENSE)

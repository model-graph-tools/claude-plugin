# Model Graph Tools

Explore the [WildFly](https://wildfly.org) management model via natural language — from any AI agent that supports [MCP](https://modelcontextprotocol.io/) and [Agent Skills](https://agentskills.io/).

WildFly exposes its entire configuration and runtime state through a management model — a tree of resources, each with attributes, operations, and capabilities. This project lets you search, browse, and compare that model across WildFly versions and feature packs, powered by Neo4j graph databases and the [`mgt`](https://github.com/model-graph-tools/tooling) CLI.

## What You Can Do

- **Search** resources, attributes, and operations by name or pattern
- **Browse** the resource tree with full attribute, operation, and capability details
- **Find** deprecated elements and track when they were deprecated
- **Filter** by stability level to find experimental, preview, or community features
- **Analyze** model statistics — element counts, stability breakdown, relationship counts
- **Compare** two WildFly versions to see what was added, removed, or deprecated — including attribute, operation, and parameter changes
- **Explore** feature pack extensions (AI, GraphQL, etc.) using the same tools
- **Run** arbitrary read-only Cypher queries for advanced use cases

## Installation

### Prerequisites

- [`mgt`](https://github.com/model-graph-tools/tooling) CLI installed and on PATH
- [Docker](https://www.docker.com/) or [Podman](https://podman.io/) for running Neo4j containers
- [Node.js](https://nodejs.org/) 20+

### Claude Code

#### From Marketplace

```bash
claude plugin marketplace add https://github.com/model-graph-tools/claude-plugin
claude plugin install mgt@model-graph-tools
```

The MCP server is fetched automatically from [npm](https://www.npmjs.com/package/@model-graph-tools/mcp-server) via `npx` — no build step required.

#### From Source

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

### Other AI Agents

The MCP server and skill follow open standards ([MCP](https://modelcontextprotocol.io/) and [Agent Skills](https://agentskills.io/)) and work with any compatible AI agent. Setup has two parts:

1. **Configure the MCP server** in your agent's settings
2. **Install the skill** by copying the `skills/wildfly-model-graph/` directory from this repository into your agent's skills folder

For most agents, the universal skills directory is `.agents/skills/` (project-level) or `~/.agents/skills/` (user-level). See the [Agent Skills client list](https://agentskills.io/clients) for all supported agents.

#### Gemini CLI

Add to `~/.gemini/settings.json` (or project-level `.gemini/settings.json`):

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

Install the skill:

```bash
# User-level (available in all projects)
cp -r skills/wildfly-model-graph ~/.agents/skills/

# Or project-level
cp -r skills/wildfly-model-graph .agents/skills/
```

#### OpenAI Codex

Add to `~/.codex/config.toml` (or project-level `.codex/config.toml`):

```toml
[mcp_servers.wildfly-model-graph]
command = "npx"
args = ["--yes", "@model-graph-tools/mcp-server"]
```

Install the skill:

```bash
cp -r skills/wildfly-model-graph ~/.agents/skills/
```

#### VS Code / GitHub Copilot

Add to `.vscode/mcp.json` in your workspace:

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

Install the skill:

```bash
# Project-level
cp -r skills/wildfly-model-graph .agents/skills/

# Or user-level
cp -r skills/wildfly-model-graph ~/.agents/skills/
```

#### Cursor

Add to `~/.cursor/mcp.json` (or project-level `.cursor/mcp.json`):

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

Install the skill:

```bash
cp -r skills/wildfly-model-graph ~/.agents/skills/
```

#### Other MCP-Compatible Agents

For any agent that supports MCP over stdio, configure it to run:

```
npx --yes @model-graph-tools/mcp-server
```

Copy the skill directory to your agent's skills folder (typically `.agents/skills/` or `~/.agents/skills/`). See the [Agent Skills specification](https://agentskills.io/specification) for details.

## Usage

### Slash Command

> [!NOTE]
> Slash commands are a Claude Code feature. Other agents use the skill (which activates automatically based on context) and MCP tools directly — see [Natural Language](#natural-language) below.

Use `/mgt:model` followed by your question:

**Model overview**

```
/mgt:model Give me an overview of the WildFly 39 management model.
/mgt:model How many resources and attributes does WildFly 39 have?
```

**Browse and search**

```
/mgt:model How do I add a new datasource?
/mgt:model How does the logging subsystem work?
/mgt:model How is TLS configured?
/mgt:model What is an authentication context?
/mgt:model Tell me more about credential stores.
```

**Stability levels**

```
/mgt:model Are there any community features in WildFly 39?
/mgt:model Show me all preview resources.
/mgt:model What community stability attributes exist?
```

**Capabilities and deprecation**

```
/mgt:model How do capabilities work?
/mgt:model What capabilities does elytron provide?
/mgt:model What operations have been deprecated recently?
```

**Compare versions**

```
/mgt:model Compare WildFly 38 and 39.
/mgt:model What attributes changed between WildFly 38 and 39?
/mgt:model Compare the IO subsystem between WildFly 23 and the latest version.
```

**Feature packs**

```
/mgt:model What resources does the AI feature pack provide?
/mgt:model Compare the first and the latest version of the AI feature pack.
```

### Natural Language

The skill also activates automatically when Claude detects WildFly management model context in your conversation — just ask about subsystems, resources, attributes, or operations naturally. So most of the questions above should also work without using the slash command.

### Container Lifecycle

Each WildFly version or feature pack runs as a separate Neo4j container pulled from
[quay.io/modelgraphtools/model](https://quay.io/repository/modelgraphtools/model). The plugin manages these through `mgt`:

- Images are pulled if not present locally
- Containers are started on demand when you query a source
- If a source isn't running, the plugin will suggest starting it
- Containers started during a session are automatically stopped when the MCP server shuts down
- Containers started outside the session (e.g., via `mgt start`) persist and are not affected
- Stop containers explicitly at any time: `/mgt:model stop WildFly 39`

## Related Projects

This plugin is part of the [model-graph-tools](https://github.com/model-graph-tools) ecosystem:

| Project | Description |
|---------|-------------|
| [tooling](https://github.com/model-graph-tools/tooling) | `mgt` — Command line tool that analyzes WildFly instances, builds Neo4j model images, and manages container lifecycle |
| [analyzer](https://github.com/model-graph-tools/analyzer) | Java tool that reads the WildFly management model and populates Neo4j                                                 |

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
│   ├── plugin.json              # Plugin manifest (skills, mcpServers)
│   └── marketplace.json         # Marketplace manifest
├── skills/
│   └── wildfly-model-graph/
│       ├── SKILL.md             # Skill prompt with domain knowledge
│       └── references/
│           ├── cypher-queries.md # Cypher query reference
│           └── graph-schema.md  # Neo4j graph schema reference
├── commands/
│   └── model.md                 # /mgt:model slash command
├── mcp-server/
│   ├── src/
│   │   ├── index.ts             # Server entry point, tool registration
│   │   ├── neo4j.ts             # Neo4j connection management
│   │   ├── mgt.ts               # mgt CLI wrapper
│   │   ├── session.ts           # Session state management
│   │   └── tools/               # One file per MCP tool (16 tools)
│   ├── build.mjs                # Custom build script
│   ├── package.json
│   └── tsconfig.json
├── CLAUDE.md                    # Claude Code project instructions
└── README.md
```

### Adding a New Tool

1. Create a new file in `mcp-server/src/tools/`
2. Implement the query function with a Neo4j session
3. Register the tool in `mcp-server/src/index.ts` with a Zod input schema
4. Update the skill prompt in `skills/wildfly-model-graph/SKILL.md` with usage guidance

## License

[Apache License 2.0](LICENSE)

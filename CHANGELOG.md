# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.2] - 2026-05-02

### Changed
- Add skill guidance for "how do I add/configure X" questions to avoid unnecessary JSON post-processing
- Add targeted Cypher query examples for add operation parameters and required attributes

## [0.6.1] - 2025-05-02

### Fixed
- Resilient Neo4j connection management with auto-recovery
- Complete tool coverage in command and skill files

## [0.6.0] - 2025-05-01

### Added
- Stability queries (`find_by_stability`) for experimental, preview, community, and default levels
- Model statistics (`get_statistics`) with node counts, stability breakdown, and relationship counts
- Deeper version diffs (`compare_versions`) with attribute and operation change detection within shared resources

## [0.5.3] - 2025-04-30

### Fixed
- Fix missing npm README in published package

## [0.5.0] - 2025-04-30

### Added
- Auto-stop session-started containers on shutdown

### Changed
- Use colon-separated identifiers for feature packs (e.g., `ai:0.9.1`)
- Improve skill and plugin hygiene

### Fixed
- Register connections for externally started containers
- Use canonical identifiers from `mgt` for connection registration

## [0.4.0] - 2025-04-29

### Changed
- Read MCP server version from `package.json` at runtime instead of hardcoding

## [0.3.1] - 2025-04-29

### Fixed
- Clarify that `start_source` / `stop_source` operates on the model database, not WildFly itself

## [0.3.0] - 2025-04-28

### Added
- Initial public release as Claude Code plugin with MCP server
- 10 MCP tools: `list_sources`, `start_source`, `stop_source`, `search_resources`, `browse_resource`, `search_operations`, `search_attributes`, `find_capabilities`, `find_deprecated`, `run_cypher`
- Published MCP server as npm package `@model-graph-tools/mcp-server`
- Skill prompt with domain knowledge for WildFly management model
- Marketplace manifest for plugin discovery

[Unreleased]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.2...HEAD
[0.6.2]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/model-graph-tools/claude-plugin/compare/v0.5.3...v0.6.0
[0.5.3]: https://github.com/model-graph-tools/claude-plugin/compare/v0.5.0...v0.5.3
[0.5.0]: https://github.com/model-graph-tools/claude-plugin/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/model-graph-tools/claude-plugin/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/model-graph-tools/claude-plugin/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/model-graph-tools/claude-plugin/releases/tag/v0.3.0

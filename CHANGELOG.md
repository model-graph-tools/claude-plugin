# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.2] - 2026-05-05

### Changed
- Broaden skill trigger phrases with "JBoss", "management API", and "configuration schema" for better discovery by users unfamiliar with "model graph" terminology
- Qualify the critical rule about not piping tool output through shell commands as applicable to agents with shell access, making the skill more agent-agnostic
- Add explicit guidance to read reference files before writing `run_cypher` queries

### Fixed
- Fix `default` property name in graph schema reference — actual Neo4j property is `default-value` (requires backtick escaping in Cypher)
- Fix Cypher example query using `a.default` instead of correct `` a.`default-value` `` property name

## [0.8.1] - 2026-05-05

### Changed
- Clarify in skill and graph schema that deprecation versions refer to the management model version, not the WildFly server version

### Fixed
- Fix deprecation version info always returning null — all Cypher queries referenced a non-existent `name` property on `Version` nodes instead of constructing the version string from `major`, `minor`, and `patch` properties
- Fix deprecation result sorting in `find_deprecated` to use numeric `ordinal` instead of lexicographic version string comparison

## [0.8.0] - 2026-05-04

### Added
- Cross-platform installation instructions for Gemini CLI, OpenAI Codex, VS Code / GitHub Copilot, Cursor, and generic MCP-compatible agents
- Platform configuration section in MCP server README with config snippets for all major AI agents
- Unit tests for `utils.ts`, `mgt.ts`, `neo4j.ts`, and `run-cypher.ts` (71 tests total across 5 test files)

### Changed
- Sync skill metadata version to match the plugin version (0.7.6)
- Add "model graph", "EAP", and "compare WildFly versions" as explicit trigger terms in skill description
- Deduplicate wording rules by removing redundant block at the top of a tool usage section
- Add a reference file pointer to the `run_cypher` row in the intent mapping table
- Make SKILL.md fully compliant with the [Agent Skills](https://agentskills.io/) open standard — add `license`, `compatibility`, and `metadata` fields; move `version` into `metadata`
- Broaden project positioning from Claude Code-only to multi-platform (any MCP + Agent Skills compatible agent)
- Extract duplicated `escapeRegex`, `toNumber`, and `validateQueryLength` utilities into shared `utils.ts` module

### Fixed
- Include `SKILL.md` metadata version in `versionBump.sh` and `release.sh` to prevent version drift across releases
- Remove `shell: true` from `execFileAsync` calls to eliminate command injection risk
- Increase Neo4j connection pool size from 5 to 10 to accommodate `browse_resource` parallel sessions
- Strengthen Cypher mutation detection with Unicode normalization (NFKC) and additional keywords (`FOREACH`, `CALL {}`)
- Add query length limits to `run_cypher` (10,000 chars) and search tools (200 chars) to prevent ReDoS
- Replace silent `.catch(() => {})` blocks with error logging for better debuggability
- Remove dead `clearActiveSource` export from `neo4j.ts`

## [0.7.6] - 2026-05-04

### Changed
- Strengthen wording rules in skill to explicitly prohibit "start WildFly" phrasing in all responses, not just start/stop scenarios
- Add a critical wording rule at the top of the tool usage section as an unmissable reminder
- Make `start_source` tool description more emphatic about the model graph vs. WildFly distinction

## [0.7.5] - 2026-05-04

> [!WARNING]
> Not an official release. Please don't use!

## [0.7.4] - 2026-05-03

### Fixed
- Clarify skill wording to say "start the model graph for" a WildFly version, not "start" the version itself

## [0.7.3] - 2026-05-03

### Fixed
- Include README.md in npm published package to restore documentation on npmjs.com

## [0.7.2] - 2026-05-03

### Added
- `browse_resource` now includes sub-attribute composition for complex types (LIST, OBJECT) via CONSISTS_OF traversal
- `get_statistics` now returns model graph identity metadata (name, version, type, description) from the Identity node
- `compare_versions` now detects parameter additions and removals on shared operations across versions

### Changed
- `search_resources` now returns resource description in results
- `search_operations` now returns stability level and deprecation info (version, reason)
- `search_attributes` now returns access type and required flag
- Trim skill description for better trigger precision and add version field to skill frontmatter
- Add graph-schema reference pointer and capability query example to Cypher reference
- Consolidate duplicate `describe_resource` guidance in skill via cross-reference

## [0.7.1] - 2026-05-03

### Changed
- Update skill description with trigger phrases for newer tools (`get_resource_tree`, `find_relationships`, `describe_resource`) and add "JBoss EAP" as a trigger term
- Add empty-result handling guidance to the skill for when searches return zero matches
- Update command, README, and CLAUDE.md to reflect all 16 MCP tools

## [0.7.0] - 2026-05-03

### Added
- `get_resource_tree` MCP tool that returns the full resource subtree under a given address in one call, with depth info and optional depth limit — eliminates recursive `browse_resource` calls for hierarchy exploration
- `find_relationships` MCP tool that exposes REQUIRES (must be set together) and ALTERNATIVE (mutually exclusive) relationships between attributes and operation parameters for a resource
- `describe_resource` MCP tool that returns concise markdown (not JSON) with required add-operation parameters, required/optional attributes, and a CLI example — purpose-built for "how do I add/configure X?" questions

### Changed
- `find_deprecated` now includes parameters in deprecation search (previously only resources, attributes, and operations)
- `find_by_stability` now includes parameters in stability search (previously only resources, attributes, and operations)
- `find_capabilities` now shows parameter capability references alongside attribute references via `referencedByParameters` field
- `search_resources` now matches against resource descriptions in addition to name and address

## [0.6.6] - 2026-05-03

## [0.6.5] - 2026-05-03

### Changed
- Use targeted Cypher queries instead of `browse_resource` for "how do I add/configure X" questions to avoid large payloads that trigger JSON post-processing workarounds
- Add an explicit prohibition against reading cached tool-result files or piping MCP output through shell scripts

## [0.6.4] - 2026-05-03

### Added
- Timeout protection for all `mgt` CLI calls (5 min for start, 30 sec for others) to prevent indefinite hangs
- Actionable error messages for common Docker failures (not running, permission denied, disk full)
- Cleanup on partial failure: orphaned containers are stopped if post-start setup fails
- Skill guidance for communicating startup wait times and handling timeout/Docker errors

### Changed
- Replace technical terminology with user-friendly wording in tool descriptions and skill
- Broaden skill trigger phrasing for custom query matching and deduplicate inline Cypher templates by pointing to a reference file

## [0.6.3] - 2026-05-02

### Added
- Centralized identifier resolution via `mgt resolve` that normalizes user input (e.g., `"39"` → `"39.0"`, `"ai"` → `"ai:0.9.1"`) before connection lookup
- Unit tests for identifier resolution using vitest

### Fixed
- Resolve identifier mismatch that caused connection lookup failures when abbreviated identifiers were used, leading to unnecessary container stop/remove cycles

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

[Unreleased]: https://github.com/model-graph-tools/claude-plugin/compare/v0.8.2...HEAD
[0.8.2]: https://github.com/model-graph-tools/claude-plugin/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/model-graph-tools/claude-plugin/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/model-graph-tools/claude-plugin/compare/v0.7.6...v0.8.0
[0.7.6]: https://github.com/model-graph-tools/claude-plugin/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/model-graph-tools/claude-plugin/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/model-graph-tools/claude-plugin/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/model-graph-tools/claude-plugin/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/model-graph-tools/claude-plugin/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/model-graph-tools/claude-plugin/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.6...v0.7.0
[0.6.6]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/model-graph-tools/claude-plugin/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/model-graph-tools/claude-plugin/compare/v0.5.3...v0.6.0
[0.5.3]: https://github.com/model-graph-tools/claude-plugin/compare/v0.5.0...v0.5.3
[0.5.0]: https://github.com/model-graph-tools/claude-plugin/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/model-graph-tools/claude-plugin/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/model-graph-tools/claude-plugin/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/model-graph-tools/claude-plugin/releases/tag/v0.3.0

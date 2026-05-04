#!/usr/bin/env bash
#
#  Copyright 2025 Red Hat
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#


# -------------------------------------------------------
#
# Bumps the version in
#   - .claude-plugin/plugin.json
#   - mcp-server/package.json
#
# -------------------------------------------------------

set -Eeuo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)
readonly script_dir
cd "${script_dir}"

die() {
  echo >&2 "$1"
  exit "${2-1}"
}

is_semver() {
  local version="$1"
  [[ ${version} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

[[ $# -eq 1 ]] || die "Usage: $(basename "${BASH_SOURCE[0]}") <version>"
VERSION=$1
is_semver "${VERSION}" || die "Version is not a semantic version: ${VERSION}"

# .claude-plugin/plugin.json: update "version" and "@model-graph-tools/mcp-server@X.Y.Z"
sed -i '' -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"${VERSION}\"/" .claude-plugin/plugin.json
sed -i '' -E "s/@model-graph-tools\/mcp-server@[0-9]+\.[0-9]+\.[0-9]+/@model-graph-tools\/mcp-server@${VERSION}/" .claude-plugin/plugin.json

# skills/wildfly-model-graph/SKILL.md: update metadata.version
sed -i '' -E "s/version: \"[0-9]+\.[0-9]+\.[0-9]+\"/version: \"${VERSION}\"/" skills/wildfly-model-graph/SKILL.md

# mcp-server/package.json: update top-level "version" only
node -e "
const fs = require('fs');
const path = 'mcp-server/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = '${VERSION}';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

echo "Version bumped to ${VERSION}"

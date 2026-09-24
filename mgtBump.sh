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
# Bumps the bundled mgt binary version in
#   - mcp-server/package.json (optionalDependencies)
#   - mcp-server/package-lock.json (via npm install)
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

[[ $# -eq 1 ]] || die "Usage: $(basename "${BASH_SOURCE[0]}") <mgt-version>"
VERSION=$1
is_semver "${VERSION}" || die "Version is not a semantic version: ${VERSION}"

PLATFORMS=(
  "@model-graph-tools/mgt-darwin-arm64"
  "@model-graph-tools/mgt-darwin-x64"
  "@model-graph-tools/mgt-linux-arm64"
  "@model-graph-tools/mgt-linux-x64"
  "@model-graph-tools/mgt-win32-x64"
)

# Verify all platform packages exist on npm
for pkg in "${PLATFORMS[@]}"; do
  if ! npm view "${pkg}@${VERSION}" version &>/dev/null; then
    die "${pkg}@${VERSION} not found on npm"
  fi
done

# Update optionalDependencies in mcp-server/package.json
node -e "
const fs = require('fs');
const path = 'mcp-server/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const key of Object.keys(pkg.optionalDependencies || {})) {
  if (key.startsWith('@model-graph-tools/mgt-')) {
    pkg.optionalDependencies[key] = '${VERSION}';
  }
}
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

# Regenerate package-lock.json
(cd mcp-server && npm install)

echo "mgt bumped to ${VERSION}"

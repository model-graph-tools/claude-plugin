// Wraps the `mgt` CLI to manage Neo4j model graph containers.
// All commands are invoked with `--json` for machine-readable output.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";

// --- Constants ---

const execFileAsync = promisify(execFile);
const MGT_START_TIMEOUT_MS = 300_000;
const MGT_DEFAULT_TIMEOUT_MS = 30_000;

const PLATFORM_PACKAGES: Record<string, string> = {
  "linux-x64": "@model-graph-tools/mgt-linux-x64",
  "linux-arm64": "@model-graph-tools/mgt-linux-arm64",
  "darwin-x64": "@model-graph-tools/mgt-darwin-x64",
  "darwin-arm64": "@model-graph-tools/mgt-darwin-arm64",
  "win32-x64": "@model-graph-tools/mgt-win32-x64",
};

function resolveMgtBinary(): string {
  const key = `${process.platform}-${process.arch}`;
  const pkg = PLATFORM_PACKAGES[key];
  if (pkg) {
    try {
      const require = createRequire(import.meta.url);
      const pkgDir = join(require.resolve(`${pkg}/package.json`), "..");
      const binary = process.platform === "win32" ? "mgt.exe" : "mgt";
      const binPath = join(pkgDir, "bin", binary);
      if (existsSync(binPath)) {
        return binPath;
      }
    } catch {
      // Package not installed — fall through to PATH
    }
  }
  return "mgt";
}

const MGT_COMMAND = resolveMgtBinary();

// --- Types ---

export interface WildFlyVersion {
  identifier: number;
  version: string;
  short_version: string;
}

export interface FeaturePack {
  shortcut: string;
  name: string;
  version: string;
}

export interface RunningContainer {
  identifier: string;
  source_type: string;
  name: string;
  container_name: string;
  bolt: number;
  http: number;
  status: string;
  id: string;
}

export interface StartResult {
  identifier: string;
  success: boolean;
  bolt?: number;
  http?: number;
  error?: string;
  error_code?: string;
}

export interface StopResult {
  identifier: string;
  success: boolean;
  error?: string;
  error_code?: string;
}

interface MgtJsonError {
  error: { code: string; message: string };
}

// --- Error handling ---

export class MgtCliError extends Error {
  public readonly errorCode: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MgtCliError";
    this.errorCode = code;
  }
}

function tryParseJsonError(stdout: string): MgtJsonError | null {
  if (!stdout.trim()) return null;
  try {
    const parsed = JSON.parse(stdout.trim());
    if (parsed?.error?.code && parsed?.error?.message) {
      return parsed as MgtJsonError;
    }
  } catch {
    // not valid JSON
  }
  return null;
}

// --- Command execution ---

export async function runMgt(
  args: string[],
  timeoutMs: number = MGT_DEFAULT_TIMEOUT_MS
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(MGT_COMMAND, [...args, "--json"], {
      timeout: timeoutMs,
    });
    return stdout;
  } catch (error: unknown) {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException & {
        killed?: boolean;
        signal?: string;
        stderr?: string;
        stdout?: string;
      };
      if (nodeError.code === "ENOENT") {
        throw new Error(
          "mgt CLI not found. It should be installed automatically as part of the MCP server package. " +
            "If it's missing, try reinstalling the MCP server or install mgt manually from " +
            "https://github.com/model-graph-tools/tooling"
        );
      }
      if (nodeError.killed && nodeError.signal === "SIGTERM") {
        const seconds = Math.round(timeoutMs / 1000);
        throw new Error(
          `mgt ${args[0]} timed out after ${seconds}s. ` +
            "This can happen on first use when container images need to be downloaded. " +
            "To resolve: (1) Verify Docker is running ('docker info'). " +
            "(2) Check your network connection — the first run downloads ~500MB. " +
            "(3) Try again — the download may have been slow but should resume."
        );
      }

      const jsonError = tryParseJsonError(nodeError.stdout ?? "");
      if (jsonError) {
        throw new MgtCliError(jsonError.error.code, jsonError.error.message);
      }

      // Fallback for older mgt versions without structured error codes
      const stderr = nodeError.stderr ?? "";
      const message = parseMgtError(args[0], stderr);
      if (message) {
        throw new Error(message);
      }
    }
    throw error;
  }
}

/** @deprecated Fallback for mgt versions that don't emit JSON error codes. */
function parseMgtError(command: string, stderr: string): string | null {
  const lower = stderr.toLowerCase();
  if (
    lower.includes("cannot connect to the docker daemon") ||
    lower.includes("is the docker daemon running") ||
    lower.includes("docker daemon is not running")
  ) {
    return `mgt ${command} failed: Docker does not appear to be running. Start Docker and try again.`;
  }
  if (lower.includes("permission denied")) {
    return `mgt ${command} failed: Permission denied. Check that your user has access to Docker.`;
  }
  if (lower.includes("no space left on device") || lower.includes("disk full")) {
    return `mgt ${command} failed: No disk space available for the container image.`;
  }
  if (
    lower.includes("invalid version or feature pack") ||
    lower.includes("unknown version") ||
    lower.includes("unknown feature pack")
  ) {
    const match = stderr.match(/invalid version or feature pack '([^']+)'/i)
      ?? stderr.match(/unknown (?:version|feature pack) '?([^'"\n]+)/i);
    const id = match?.[1] ?? "the requested identifier";
    return (
      `"${id}" is not a known WildFly version or feature pack. ` +
      "Use the list_sources tool to see available versions and feature packs."
    );
  }
  if (
    lower.includes("wildfly-images.toml") ||
    lower.includes("feature-packs.toml") ||
    lower.includes("mgt update")
  ) {
    return (
      `mgt ${command} failed: WildFly metadata configuration is missing or corrupt. ` +
      "Run 'mgt update' to download the latest configuration files. " +
      "This requires network access to GitHub."
    );
  }
  if (
    lower.includes("error sending request") ||
    lower.includes("connection refused") ||
    lower.includes("dns error") ||
    lower.includes("timed out") ||
    lower.includes("network is unreachable")
  ) {
    return (
      `mgt ${command} failed: A network request failed. ` +
      "Check your internet connection. " +
      "If this is the first run, mgt needs to download metadata from GitHub."
    );
  }
  if (stderr.trim()) {
    return `mgt ${command} failed: ${stderr.trim()}`;
  }
  return null;
}

// --- High-level CLI commands ---

export async function mgtUpdate(): Promise<void> {
  await runMgt(["update"]);
}

export async function mgtVersions(): Promise<WildFlyVersion[]> {
  const output = await runMgt(["versions"]);
  return JSON.parse(output) as WildFlyVersion[];
}

export async function mgtFeaturePacks(): Promise<FeaturePack[]> {
  const output = await runMgt(["feature-packs"]);
  return JSON.parse(output) as FeaturePack[];
}

export async function mgtPs(): Promise<RunningContainer[]> {
  const output = await runMgt(["ps"]);
  return JSON.parse(output) as RunningContainer[];
}

export async function mgtStart(identifier: string): Promise<StartResult> {
  const output = await runMgt(["start", identifier], MGT_START_TIMEOUT_MS);
  const results = JSON.parse(output) as StartResult[];
  if (results.length === 0) {
    throw new Error(`mgt start returned no results for "${identifier}"`);
  }
  return results[0];
}

export async function mgtStop(identifier: string): Promise<StopResult> {
  const output = await runMgt(["stop", identifier]);
  const results = JSON.parse(output) as StopResult[];
  if (results.length === 0) {
    throw new Error(`mgt stop returned no results for "${identifier}"`);
  }
  return results[0];
}

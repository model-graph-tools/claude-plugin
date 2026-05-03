import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MGT_COMMAND = "mgt";
const MGT_START_TIMEOUT_MS = 300_000;
const MGT_DEFAULT_TIMEOUT_MS = 30_000;

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
}

export interface StopResult {
  identifier: string;
  success: boolean;
  error?: string;
}

async function runMgt(
  args: string[],
  timeoutMs: number = MGT_DEFAULT_TIMEOUT_MS
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(MGT_COMMAND, [...args, "--json"], {
      shell: true,
      timeout: timeoutMs,
    });
    return stdout;
  } catch (error: unknown) {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException & {
        killed?: boolean;
        signal?: string;
        stderr?: string;
      };
      if (nodeError.code === "ENOENT") {
        throw new Error(
          "mgt CLI not found on PATH. Install it from https://github.com/model-graph-tools/tooling"
        );
      }
      if (nodeError.killed && nodeError.signal === "SIGTERM") {
        const seconds = Math.round(timeoutMs / 1000);
        throw new Error(
          `mgt ${args[0]} timed out after ${seconds}s. ` +
            "Check that Docker is running and has network access for image pulls."
        );
      }
      const stderr = nodeError.stderr ?? "";
      const message = parseMgtError(args[0], stderr);
      if (message) {
        throw new Error(message);
      }
    }
    throw error;
  }
}

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
  if (stderr.trim()) {
    return `mgt ${command} failed: ${stderr.trim()}`;
  }
  return null;
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

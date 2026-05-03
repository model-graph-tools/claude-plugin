import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MGT_COMMAND = "mgt";
const RESOLVE_TIMEOUT_MS = 30_000;

interface ResolveResult {
  identifier: string;
  source_type: string;
  name: string;
}

export async function resolveIdentifier(input: string): Promise<string> {
  const results = await mgtResolve(input);
  return results[0].identifier;
}

export async function resolveIdentifiers(
  id1: string,
  id2: string
): Promise<[string, string]> {
  const results = await mgtResolve(`${id1},${id2}`);
  return [results[0].identifier, results[1].identifier];
}

async function mgtResolve(input: string): Promise<ResolveResult[]> {
  try {
    const { stdout } = await execFileAsync(
      MGT_COMMAND,
      ["resolve", input, "--json"],
      { shell: true, timeout: RESOLVE_TIMEOUT_MS }
    );
    const results = JSON.parse(stdout) as ResolveResult[];
    if (results.length === 0) {
      throw new Error(`Could not resolve identifier "${input}"`);
    }
    return results;
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
        throw new Error(
          `Resolving identifier "${input}" timed out. Check that mgt is working correctly.`
        );
      }
      if (nodeError.stderr?.trim()) {
        throw new Error(
          `Failed to resolve "${input}": ${nodeError.stderr.trim()}`
        );
      }
    }
    throw error;
  }
}

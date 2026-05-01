import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MGT_COMMAND = "mgt";

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

class MgtNotFoundError extends Error {
  constructor() {
    super(
      "mgt CLI not found on PATH. Install it from https://github.com/model-graph-tools/tooling"
    );
    this.name = "MgtNotFoundError";
  }
}

async function runMgt(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(MGT_COMMAND, [...args, "--json"]);
    return stdout;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new MgtNotFoundError();
    }
    throw error;
  }
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
  const output = await runMgt(["start", identifier]);
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

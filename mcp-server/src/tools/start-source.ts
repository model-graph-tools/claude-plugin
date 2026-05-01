import { mgtStart } from "../mgt.js";
import { registerConnection } from "../neo4j.js";
import { trackStarted } from "../session.js";

interface StartSourceResult {
  identifier: string;
  status: "running";
  bolt: number;
  http: number;
}

export async function startSource(
  identifier: string
): Promise<StartSourceResult> {
  const result = await mgtStart(identifier);
  if (!result.success) {
    throw new Error(
      result.error ?? `Failed to start source "${identifier}"`
    );
  }
  if (!result.bolt || !result.http) {
    throw new Error(
      `mgt start succeeded but did not return port information for "${identifier}"`
    );
  }
  registerConnection(identifier, result.bolt);
  trackStarted(identifier);
  return {
    identifier,
    status: "running",
    bolt: result.bolt,
    http: result.http,
  };
}

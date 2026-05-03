import { mgtStart, mgtStop } from "../mgt.js";
import { refreshConnection } from "../neo4j.js";
import { trackStarted } from "../session.js";

interface StartSourceResult {
  identifier: string;
  status: "running";
  bolt: number;
  http: number;
  message: string;
}

export async function startSource(
  identifier: string
): Promise<StartSourceResult> {
  const result = await mgtStart(identifier);
  if (!result.success) {
    throw new Error(
      result.error ?? `Failed to start model graph "${identifier}"`
    );
  }
  if (!result.bolt || !result.http) {
    throw new Error(
      `mgt start succeeded but did not return port information for "${identifier}"`
    );
  }
  const canonicalId = result.identifier ?? identifier;
  try {
    refreshConnection(canonicalId, result.bolt);
    trackStarted(canonicalId);
  } catch (error) {
    await mgtStop(canonicalId).catch(() => {});
    throw error;
  }
  return {
    identifier: canonicalId,
    status: "running",
    bolt: result.bolt,
    http: result.http,
    message: `Model graph "${canonicalId}" is now running and ready for queries.`,
  };
}

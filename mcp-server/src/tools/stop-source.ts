// Stops a running model graph container and cleans up its Neo4j connection.

import { mgtStop } from "../mgt.js";
import { closeConnection } from "../neo4j.js";
import { untrackStarted } from "../session.js";

interface StopSourceResult {
  identifier: string;
  status: "stopped";
}

export async function stopSource(
  identifier: string
): Promise<StopSourceResult> {
  const result = await mgtStop(identifier);
  if (!result.success) {
    throw new Error(
      result.error ?? `Failed to stop model graph "${identifier}"`
    );
  }
  const canonicalId = result.identifier ?? identifier;
  await closeConnection(canonicalId);
  untrackStarted(canonicalId);
  return {
    identifier: canonicalId,
    status: "stopped",
  };
}

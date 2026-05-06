// Starts a model graph container via `mgt start`, establishes a Neo4j connection,
// and tracks it for graceful shutdown. Rolls back on connection failure.

import { mgtStart, mgtStop, mgtPs } from "../mgt.js";
import { refreshConnection, waitForReady } from "../neo4j.js";
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
    // Container might already be running (name conflict) — check before failing
    const running = await findRunning(identifier);
    if (running) {
      return running;
    }
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
    await waitForReady(canonicalId);
    trackStarted(canonicalId);
  } catch (error) {
    await mgtStop(canonicalId).catch((err) => {
      console.error(`Failed to stop ${canonicalId} during rollback:`, err);
    });
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

async function findRunning(
  identifier: string
): Promise<StartSourceResult | null> {
  try {
    const containers = await mgtPs();
    const container = containers.find((c) => c.identifier === identifier);
    if (!container) return null;

    refreshConnection(identifier, container.bolt);
    await waitForReady(identifier);
    // Do not call trackStarted — we didn't start this container
    return {
      identifier,
      status: "running",
      bolt: container.bolt,
      http: container.http,
      message: `Model graph "${identifier}" is already running and ready for queries.`,
    };
  } catch {
    return null;
  }
}

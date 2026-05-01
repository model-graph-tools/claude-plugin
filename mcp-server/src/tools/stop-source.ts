import { mgtStop } from "../mgt.js";
import { closeConnection } from "../neo4j.js";

interface StopSourceResult {
  identifier: string;
  status: "stopped";
}

export async function stopSource(
  identifier: string
): Promise<StopSourceResult> {
  await closeConnection(identifier);
  const result = await mgtStop(identifier);
  if (!result.success) {
    throw new Error(
      result.error ?? `Failed to stop source "${identifier}"`
    );
  }
  return {
    identifier: result.identifier,
    status: "stopped",
  };
}

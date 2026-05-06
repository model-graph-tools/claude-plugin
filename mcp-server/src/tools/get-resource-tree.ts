// Returns the subtree of resources under a given address using variable-length
// CHILD_OF traversal, with optional depth limit.

import { getSession } from "../neo4j.js";

interface ResourceTreeEntry {
  address: string;
  name: string;
  singleton: boolean;
  depth: number;
}

interface ResourceTreeResult {
  root: string;
  resources: ResourceTreeEntry[];
  totalCount: number;
}

export async function getResourceTree(
  identifier: string,
  address: string,
  depth?: number
): Promise<ResourceTreeResult> {
  const session = await getSession(identifier);
  try {
    const depthClause = depth != null && depth >= 0
      ? `CHILD_OF*0..${Math.floor(depth)}`
      : "CHILD_OF*0..";

    const result = await session.run(
      `MATCH (root:Resource {address: $address})
       MATCH (r:Resource)-[:${depthClause}]->(root)
       RETURN r.address AS address, r.name AS name, r.singleton AS singleton
       ORDER BY r.address`,
      { address }
    );

    if (result.records.length === 0) {
      throw new Error(
        `Resource not found: ${address}. Use search_resources to find valid addresses.`
      );
    }

    const rootDepth = address === "/" ? 0 : address.split("/").length - 1;

    return {
      root: address,
      resources: result.records.map((r) => {
        const addr = r.get("address") as string;
        const addrDepth = addr === "/" ? 0 : addr.split("/").length - 1;
        return {
          address: addr,
          name: r.get("name") as string,
          singleton: (r.get("singleton") as boolean) ?? false,
          depth: addrDepth - rootDepth,
        };
      }),
      totalCount: result.records.length,
    };
  } finally {
    await session.close();
  }
}

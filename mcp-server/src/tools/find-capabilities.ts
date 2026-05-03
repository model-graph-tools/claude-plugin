import { getSession } from "../neo4j.js";

interface CapabilityReference {
  attribute: string;
  resource: string;
}

interface ParameterReference {
  parameter: string;
  operation: string;
  resource: string;
}

interface CapabilityResult {
  capability: string;
  declaredBy: string[];
  referencedBy: CapabilityReference[];
  referencedByParameters: ParameterReference[];
}

export async function findCapabilities(
  identifier: string,
  query: string
): Promise<CapabilityResult[]> {
  const session = await getSession(identifier);
  try {
    const regex = `(?i).*${escapeRegex(query)}.*`;

    const result = await session.run(
      `MATCH (c:Capability)
       WHERE c.name =~ $regex
       OPTIONAL MATCH (r:Resource)-[:DECLARES_CAPABILITY]->(c)
       OPTIONAL MATCH (a:Attribute)-[:REFERENCES_CAPABILITY]->(c)
       OPTIONAL MATCH (ra:Resource)-[:HAS_ATTRIBUTE]->(a)
       OPTIONAL MATCH (p:Parameter)-[:REFERENCES_CAPABILITY]->(c)
       OPTIONAL MATCH (rp:Resource)-[:PROVIDES]->(op:Operation)-[:ACCEPTS]->(p)
       RETURN c.name AS capability,
              collect(DISTINCT r.address) AS declaredBy,
              collect(DISTINCT {attribute: a.name, resource: ra.address}) AS referencedBy,
              collect(DISTINCT {parameter: p.name, operation: op.name, resource: rp.address}) AS referencedByParameters
       ORDER BY c.name`,
      { regex }
    );

    return result.records.map((r) => ({
      capability: r.get("capability") as string,
      declaredBy: (r.get("declaredBy") as Array<string | null>).filter(
        (d): d is string => d != null
      ),
      referencedBy: (r.get("referencedBy") as Array<CapabilityReference | null>)
        .filter((ref): ref is CapabilityReference => ref?.attribute != null),
      referencedByParameters: (r.get("referencedByParameters") as Array<ParameterReference | null>)
        .filter((ref): ref is ParameterReference => ref?.parameter != null),
    }));
  } finally {
    await session.close();
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

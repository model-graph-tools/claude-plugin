// Exposes REQUIRES and ALTERNATIVE relationships between attributes and
// between operation parameters for a given resource.

import { getSessions } from "../neo4j.js";

// --- Types ---

interface AttributeRelationship {
  attribute: string;
  requires: string[];
  alternatives: string[];
}

interface ParameterRelationship {
  operation: string;
  parameter: string;
  requires: string[];
  alternatives: string[];
}

interface FindRelationshipsResult {
  address: string;
  attributeRelationships: AttributeRelationship[];
  parameterRelationships: ParameterRelationship[];
}

export async function findRelationships(
  identifier: string,
  address: string,
  scope: "attributes" | "parameters" | "all" = "all"
): Promise<FindRelationshipsResult> {
  const includeAttributes = scope === "all" || scope === "attributes";
  const includeParameters = scope === "all" || scope === "parameters";

  const sessionCount = (includeAttributes ? 1 : 0) + (includeParameters ? 1 : 0);
  const sessions = await getSessions(identifier, sessionCount);

  try {
    const promises: Promise<unknown>[] = [];

    if (includeAttributes) {
      promises.push(
        sessions[0].run(
          `MATCH (r:Resource {address: $address})-[:HAS_ATTRIBUTE]->(a:Attribute)
           OPTIONAL MATCH (a)-[:REQUIRES]->(req:Attribute)<-[:HAS_ATTRIBUTE]-(r)
           OPTIONAL MATCH (a)-[:ALTERNATIVE]->(alt:Attribute)<-[:HAS_ATTRIBUTE]-(r)
           WITH a.name AS attribute,
                collect(DISTINCT req.name) AS requires,
                collect(DISTINCT alt.name) AS alternatives
           WHERE size(requires) > 0 OR size(alternatives) > 0
           RETURN attribute, requires, alternatives
           ORDER BY attribute`,
          { address }
        )
      );
    }

    if (includeParameters) {
      const paramSessionIndex = includeAttributes ? 1 : 0;
      promises.push(
        sessions[paramSessionIndex].run(
          `MATCH (r:Resource {address: $address})-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)
           OPTIONAL MATCH (p)-[:REQUIRES]->(req:Parameter)<-[:ACCEPTS]-(o)
           OPTIONAL MATCH (p)-[:ALTERNATIVE]->(alt:Parameter)<-[:ACCEPTS]-(o)
           WITH o.name AS operation, p.name AS parameter,
                collect(DISTINCT req.name) AS requires,
                collect(DISTINCT alt.name) AS alternatives
           WHERE size(requires) > 0 OR size(alternatives) > 0
           RETURN operation, parameter, requires, alternatives
           ORDER BY operation, parameter`,
          { address }
        )
      );
    }

    const results = await Promise.all(promises);
    let resultIndex = 0;

    const attributeRelationships: AttributeRelationship[] = [];
    if (includeAttributes) {
      const attrResult = results[resultIndex++] as { records: Array<{ get(key: string): unknown }> };
      for (const r of attrResult.records) {
        attributeRelationships.push({
          attribute: r.get("attribute") as string,
          requires: filterNulls(r.get("requires") as Array<string | null>),
          alternatives: filterNulls(r.get("alternatives") as Array<string | null>),
        });
      }
    }

    const parameterRelationships: ParameterRelationship[] = [];
    if (includeParameters) {
      const paramResult = results[resultIndex] as { records: Array<{ get(key: string): unknown }> };
      for (const r of paramResult.records) {
        parameterRelationships.push({
          operation: r.get("operation") as string,
          parameter: r.get("parameter") as string,
          requires: filterNulls(r.get("requires") as Array<string | null>),
          alternatives: filterNulls(r.get("alternatives") as Array<string | null>),
        });
      }
    }

    return {
      address,
      attributeRelationships,
      parameterRelationships,
    };
  } finally {
    await Promise.all(sessions.map((s) => s.close()));
  }
}

function filterNulls(arr: Array<string | null>): string[] {
  return arr.filter((v): v is string => v != null);
}

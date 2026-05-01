import { getSession } from "../neo4j.js";

interface AttributeInfo {
  name: string;
  type: string;
  description: string;
  defaultValue?: string;
  deprecatedSince?: string;
  deprecationReason?: string;
}

interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface OperationInfo {
  name: string;
  description: string;
  parameters: ParameterInfo[];
  deprecatedSince?: string;
  deprecationReason?: string;
}

interface BrowseResult {
  address: string;
  name: string;
  singleton: boolean;
  children: { address: string; name: string }[];
  attributes: AttributeInfo[];
  operations: OperationInfo[];
  capabilities: string[];
}

export async function browseResource(
  identifier: string,
  address: string
): Promise<BrowseResult> {
  const sessions = [getSession(identifier), getSession(identifier), getSession(identifier), getSession(identifier)];
  try {
    const [resourceResult, attrResult, opResult, capResult] = await Promise.all([
      sessions[0].run(
        `MATCH (r:Resource {address: $address})
         OPTIONAL MATCH (child:Resource)-[:CHILD_OF]->(r)
         RETURN r.address AS address, r.name AS name, r.singleton AS singleton,
                collect(DISTINCT {address: child.address, name: child.name}) AS children`,
        { address }
      ),
      sessions[1].run(
        `MATCH (r:Resource {address: $address})-[:HAS_ATTRIBUTE]->(a:Attribute)
         OPTIONAL MATCH (a)-[d:DEPRECATED_SINCE]->(v:Version)
         RETURN a.name AS name, a.type AS type, a.description AS description,
                a.\`default-value\` AS defaultValue,
                v.name AS deprecatedSince, d.reason AS deprecationReason
         ORDER BY a.name`,
        { address }
      ),
      sessions[2].run(
        `MATCH (r:Resource {address: $address})-[:PROVIDES]->(o:Operation)
         OPTIONAL MATCH (o)-[:ACCEPTS]->(p:Parameter)
         OPTIONAL MATCH (o)-[d:DEPRECATED_SINCE]->(v:Version)
         RETURN o.name AS operation, o.description AS description,
                collect(CASE WHEN p IS NOT NULL THEN
                  {name: p.name, type: p.type, required: p.required, description: p.description}
                END) AS parameters,
                v.name AS deprecatedSince, d.reason AS deprecationReason
         ORDER BY o.name`,
        { address }
      ),
      sessions[3].run(
        `MATCH (r:Resource {address: $address})-[:DECLARES_CAPABILITY]->(c:Capability)
         RETURN c.name AS capability`,
        { address }
      ),
    ]);

    if (resourceResult.records.length === 0) {
      throw new Error(
        `Resource not found: ${address}. Use search_resources to find valid addresses.`
      );
    }

    const rec = resourceResult.records[0];
    const children = (rec.get("children") as Array<{ address: string; name: string }>)
      .filter((c) => c.address != null);

    return {
      address: rec.get("address") as string,
      name: rec.get("name") as string,
      singleton: (rec.get("singleton") as boolean) ?? false,
      children: children.map((c) => ({ address: c.address, name: c.name })),
      attributes: attrResult.records.map((r) => {
        const attr: AttributeInfo = {
          name: r.get("name") as string,
          type: r.get("type") as string,
          description: r.get("description") as string,
        };
        const dv = r.get("defaultValue");
        if (dv != null) attr.defaultValue = String(dv);
        const ds = r.get("deprecatedSince");
        if (ds != null) attr.deprecatedSince = ds as string;
        const dr = r.get("deprecationReason");
        if (dr != null) attr.deprecationReason = dr as string;
        return attr;
      }),
      operations: opResult.records.map((r) => {
        const op: OperationInfo = {
          name: r.get("operation") as string,
          description: r.get("description") as string,
          parameters: (r.get("parameters") as Array<ParameterInfo | null>).filter(
            (p): p is ParameterInfo => p != null
          ),
        };
        const ds = r.get("deprecatedSince");
        if (ds != null) op.deprecatedSince = ds as string;
        const dr = r.get("deprecationReason");
        if (dr != null) op.deprecationReason = dr as string;
        return op;
      }),
      capabilities: capResult.records.map((r) => r.get("capability") as string),
    };
  } finally {
    await Promise.all(sessions.map((s) => s.close()));
  }
}

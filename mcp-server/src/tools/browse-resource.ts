import { getSession } from "../neo4j.js";

interface SubAttributeInfo {
  name: string;
  type: string;
  description: string;
}

interface AttributeInfo {
  name: string;
  type: string;
  description: string;
  defaultValue?: string;
  accessType?: string;
  stability?: string;
  required?: boolean;
  nillable?: boolean;
  expressionsAllowed?: boolean;
  storage?: string;
  deprecatedSince?: string;
  deprecationReason?: string;
  consistsOf?: SubAttributeInfo[];
}

interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
  requires?: string[];
  alternatives?: string[];
}

interface OperationInfo {
  name: string;
  description: string;
  stability?: string;
  parameters: ParameterInfo[];
  deprecatedSince?: string;
  deprecationReason?: string;
}

interface BrowseResult {
  address: string;
  name: string;
  description?: string;
  singleton: boolean;
  stability?: string;
  parent?: string;
  children: { address: string; name: string }[];
  attributes: AttributeInfo[];
  operations: OperationInfo[];
  capabilities: string[];
}

export async function browseResource(
  identifier: string,
  address: string
): Promise<BrowseResult> {
  const sessions = await Promise.all([
    getSession(identifier),
    getSession(identifier),
    getSession(identifier),
    getSession(identifier),
    getSession(identifier),
    getSession(identifier),
  ]);
  try {
    const [resourceResult, attrResult, opResult, capResult, paramRelResult, consistsOfResult] =
      await Promise.all([
        sessions[0].run(
          `MATCH (r:Resource {address: $address})
           OPTIONAL MATCH (child:Resource)-[:CHILD_OF]->(r)
           OPTIONAL MATCH (r)-[:CHILD_OF]->(parent:Resource)
           RETURN r.address AS address, r.name AS name, r.singleton AS singleton,
                  r.description AS description, r.stability AS stability,
                  parent.address AS parent,
                  collect(DISTINCT {address: child.address, name: child.name}) AS children`,
          { address }
        ),
        sessions[1].run(
          `MATCH (r:Resource {address: $address})-[:HAS_ATTRIBUTE]->(a:Attribute)
           OPTIONAL MATCH (a)-[d:DEPRECATED_SINCE]->(v:Version)
           RETURN a.name AS name, a.type AS type, a.description AS description,
                  a.\`default-value\` AS defaultValue,
                  a.\`access-type\` AS accessType,
                  a.stability AS stability,
                  a.required AS required,
                  a.nillable AS nillable,
                  a.\`expressions-allowed\` AS expressionsAllowed,
                  a.storage AS storage,
                  (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince, d.reason AS deprecationReason
           ORDER BY a.name`,
          { address }
        ),
        sessions[2].run(
          `MATCH (r:Resource {address: $address})-[:PROVIDES]->(o:Operation)
           OPTIONAL MATCH (o)-[:ACCEPTS]->(p:Parameter)
           OPTIONAL MATCH (o)-[d:DEPRECATED_SINCE]->(v:Version)
           RETURN o.name AS operation, o.description AS description,
                  o.stability AS stability,
                  collect(CASE WHEN p IS NOT NULL THEN
                    {name: p.name, type: p.type, required: p.required, description: p.description}
                  END) AS parameters,
                  (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince, d.reason AS deprecationReason
           ORDER BY o.name`,
          { address }
        ),
        sessions[3].run(
          `MATCH (r:Resource {address: $address})-[:DECLARES_CAPABILITY]->(c:Capability)
           RETURN c.name AS capability`,
          { address }
        ),
        sessions[4].run(
          `MATCH (r:Resource {address: $address})-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)
           OPTIONAL MATCH (p)-[:REQUIRES]->(req:Parameter)<-[:ACCEPTS]-(o)
           OPTIONAL MATCH (p)-[:ALTERNATIVE]->(alt:Parameter)<-[:ACCEPTS]-(o)
           WITH o.name AS operation, p.name AS parameter,
                collect(DISTINCT req.name) AS requires,
                collect(DISTINCT alt.name) AS alternatives
           WHERE size(requires) > 0 OR size(alternatives) > 0
           RETURN operation, parameter, requires, alternatives`,
          { address }
        ),
        sessions[5].run(
          `MATCH (r:Resource {address: $address})-[:HAS_ATTRIBUTE]->(a:Attribute)
           WHERE a.type IN ['LIST', 'OBJECT']
           MATCH (a)-[:CONSISTS_OF]->(sub:Attribute)
           RETURN a.name AS parent,
                  collect({name: sub.name, type: sub.type, description: sub.description}) AS subAttributes
           ORDER BY a.name`,
          { address }
        ),
      ]);

    if (resourceResult.records.length === 0) {
      throw new Error(
        `Resource not found: ${address}. Use search_resources to find valid addresses.`
      );
    }

    // Build consists-of lookup
    const consistsOfMap = new Map<string, SubAttributeInfo[]>();
    for (const r of consistsOfResult.records) {
      const parent = r.get("parent") as string;
      const subs = (r.get("subAttributes") as SubAttributeInfo[]).filter(
        (s) => s.name != null
      );
      if (subs.length > 0) {
        consistsOfMap.set(parent, subs);
      }
    }

    // Build parameter relationship lookup
    const paramRelMap = new Map<string, { requires: string[]; alternatives: string[] }>();
    for (const r of paramRelResult.records) {
      const opName = r.get("operation") as string;
      const paramName = r.get("parameter") as string;
      const requires = (r.get("requires") as Array<string | null>).filter(
        (n): n is string => n != null
      );
      const alternatives = (r.get("alternatives") as Array<string | null>).filter(
        (n): n is string => n != null
      );
      paramRelMap.set(`${opName}:${paramName}`, { requires, alternatives });
    }

    const rec = resourceResult.records[0];
    const children = (rec.get("children") as Array<{ address: string; name: string }>)
      .filter((c) => c.address != null);

    const result: BrowseResult = {
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
        assignIfNotNull(attr, "defaultValue", r.get("defaultValue"));
        assignIfNotNull(attr, "accessType", r.get("accessType"));
        assignIfNotNull(attr, "stability", r.get("stability"));
        assignIfNotNull(attr, "storage", r.get("storage"));
        assignIfNotNull(attr, "deprecatedSince", r.get("deprecatedSince"));
        assignIfNotNull(attr, "deprecationReason", r.get("deprecationReason"));
        const req = r.get("required");
        if (req != null) attr.required = req as boolean;
        const nil = r.get("nillable");
        if (nil != null) attr.nillable = nil as boolean;
        const expr = r.get("expressionsAllowed");
        if (expr != null) attr.expressionsAllowed = expr as boolean;
        const subs = consistsOfMap.get(attr.name);
        if (subs) attr.consistsOf = subs;
        return attr;
      }),
      operations: opResult.records.map((r) => {
        const opName = r.get("operation") as string;
        const op: OperationInfo = {
          name: opName,
          description: r.get("description") as string,
          parameters: (r.get("parameters") as Array<ParameterInfo | null>)
            .filter((p): p is ParameterInfo => p != null)
            .map((p) => {
              const rels = paramRelMap.get(`${opName}:${p.name}`);
              const param: ParameterInfo = { ...p };
              if (rels?.requires.length) param.requires = rels.requires;
              if (rels?.alternatives.length) param.alternatives = rels.alternatives;
              return param;
            }),
        };
        assignIfNotNull(op, "stability", r.get("stability"));
        assignIfNotNull(op, "deprecatedSince", r.get("deprecatedSince"));
        assignIfNotNull(op, "deprecationReason", r.get("deprecationReason"));
        return op;
      }),
      capabilities: capResult.records.map((r) => r.get("capability") as string),
    };

    assignIfNotNull(result, "description", rec.get("description"));
    assignIfNotNull(result, "stability", rec.get("stability"));
    assignIfNotNull(result, "parent", rec.get("parent"));

    return result;
  } finally {
    await Promise.all(sessions.map((s) => s.close()));
  }
}

function assignIfNotNull<T extends Record<string, unknown>>(
  obj: T,
  key: keyof T,
  value: unknown
): void {
  if (value != null) {
    (obj as Record<string, unknown>)[key as string] = value;
  }
}

// Fetches a single resource with full metadata by running six parallel Cypher queries:
// resource info, attributes, operations, capabilities, parameter relationships, and sub-attributes.

import { getSessions } from "../neo4j.js";
import { pickDefined, toNumber, toNumberOrUndefined } from "../utils.js";

// --- Cypher queries ---

const RESOURCE_QUERY = `
  MATCH (r:Resource {address: $address})
  OPTIONAL MATCH (child:Resource)-[:CHILD_OF]->(r)
  OPTIONAL MATCH (r)-[:CHILD_OF]->(parent:Resource)
  RETURN r.address AS address, r.name AS name, r.singleton AS singleton,
         r.description AS description, r.stability AS stability,
         parent.address AS parent,
         collect(DISTINCT {address: child.address, name: child.name}) AS children`;

const ATTRIBUTES_QUERY = `
  MATCH (r:Resource {address: $address})-[:HAS_ATTRIBUTE]->(a:Attribute)
  OPTIONAL MATCH (a)-[d:DEPRECATED_SINCE]->(v:Version)
  RETURN a.name AS name, a.type AS type, a.description AS description,
         a.\`default-value\` AS defaultValue,
         a.\`access-type\` AS accessType,
         a.stability AS stability,
         a.required AS required,
         a.nillable AS nillable,
         a.\`expressions-allowed\` AS expressionsAllowed,
         a.storage AS storage,
         a.allowed AS allowed,
         a.unit AS unit,
         a.\`restart-required\` AS restartRequired,
         a.min AS min, a.max AS max,
         a.\`min-length\` AS minLength, a.\`max-length\` AS maxLength,
         a.\`attribute-group\` AS attributeGroup,
         a.\`value-type\` AS valueType,
         (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince, d.reason AS deprecationReason
  ORDER BY a.name`;

const OPERATIONS_QUERY = `
  MATCH (r:Resource {address: $address})-[:PROVIDES]->(o:Operation)
  OPTIONAL MATCH (o)-[:ACCEPTS]->(p:Parameter)
  OPTIONAL MATCH (o)-[d:DEPRECATED_SINCE]->(v:Version)
  RETURN o.name AS operation, o.description AS description,
         o.stability AS stability,
         o.global AS global, o.\`read-only\` AS readOnly,
         o.\`runtime-only\` AS runtimeOnly, o.\`return-value\` AS returnValue,
         collect(CASE WHEN p IS NOT NULL THEN
           {name: p.name, type: p.type, required: p.required, description: p.description,
            allowed: p.allowed, unit: p.unit, nillable: p.nillable,
            expressionsAllowed: p.\`expressions-allowed\`,
            min: p.min, max: p.max, minLength: p.\`min-length\`, maxLength: p.\`max-length\`,
            valueType: p.\`value-type\`}
         END) AS parameters,
         (v.major + '.' + v.minor + '.' + v.patch) AS deprecatedSince, d.reason AS deprecationReason
  ORDER BY o.name`;

const CAPABILITIES_QUERY = `
  MATCH (r:Resource {address: $address})-[:DECLARES_CAPABILITY]->(c:Capability)
  RETURN c.name AS capability`;

const PARAM_RELATIONSHIPS_QUERY = `
  MATCH (r:Resource {address: $address})-[:PROVIDES]->(o:Operation)-[:ACCEPTS]->(p:Parameter)
  OPTIONAL MATCH (p)-[:REQUIRES]->(req:Parameter)<-[:ACCEPTS]-(o)
  OPTIONAL MATCH (p)-[:ALTERNATIVE]->(alt:Parameter)<-[:ACCEPTS]-(o)
  WITH o.name AS operation, p.name AS parameter,
       collect(DISTINCT req.name) AS requires,
       collect(DISTINCT alt.name) AS alternatives
  WHERE size(requires) > 0 OR size(alternatives) > 0
  RETURN operation, parameter, requires, alternatives`;

const CONSISTS_OF_QUERY = `
  MATCH (r:Resource {address: $address})-[:HAS_ATTRIBUTE]->(a:Attribute)
  WHERE a.type IN ['LIST', 'OBJECT']
  MATCH (a)-[:CONSISTS_OF]->(sub:Attribute)
  RETURN a.name AS parent,
         collect({name: sub.name, type: sub.type, description: sub.description}) AS subAttributes
  ORDER BY a.name`;

// --- Types ---

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
  allowed?: string[];
  unit?: string;
  restartRequired?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  attributeGroup?: string;
  valueType?: string;
  deprecatedSince?: string;
  deprecationReason?: string;
  consistsOf?: SubAttributeInfo[];
}

interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
  allowed?: string[];
  unit?: string;
  nillable?: boolean;
  expressionsAllowed?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  valueType?: string;
  requires?: string[];
  alternatives?: string[];
}

interface OperationInfo {
  name: string;
  description: string;
  stability?: string;
  global?: boolean;
  readOnly?: boolean;
  runtimeOnly?: boolean;
  returnValue?: string;
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

// --- Main ---

export async function browseResource(
  identifier: string,
  address: string
): Promise<BrowseResult> {
  const sessions = await getSessions(identifier, 6);
  try {
    const [resourceResult, attrResult, opResult, capResult, paramRelResult, consistsOfResult] =
      await Promise.all([
        sessions[0].run(RESOURCE_QUERY, { address }),
        sessions[1].run(ATTRIBUTES_QUERY, { address }),
        sessions[2].run(OPERATIONS_QUERY, { address }),
        sessions[3].run(CAPABILITIES_QUERY, { address }),
        sessions[4].run(PARAM_RELATIONSHIPS_QUERY, { address }),
        sessions[5].run(CONSISTS_OF_QUERY, { address }),
      ]);

    if (resourceResult.records.length === 0) {
      throw new Error(
        `Resource not found: ${address}. Use search_resources to find valid addresses.`
      );
    }

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

    const paramRelMap = new Map<string, { requires: string[]; alternatives: string[] }>();
    for (const r of paramRelResult.records) {
      const requires = (r.get("requires") as Array<string | null>).filter(
        (n): n is string => n != null
      );
      const alternatives = (r.get("alternatives") as Array<string | null>).filter(
        (n): n is string => n != null
      );
      paramRelMap.set(`${r.get("operation")}:${r.get("parameter")}`, { requires, alternatives });
    }

    const rec = resourceResult.records[0];
    const children = (rec.get("children") as Array<{ address: string; name: string }>)
      .filter((c) => c.address != null);

    return {
      address: rec.get("address") as string,
      name: rec.get("name") as string,
      singleton: (rec.get("singleton") as boolean) ?? false,
      children: children.map((c) => ({ address: c.address, name: c.name })),
      attributes: attrResult.records.map((r) => mapAttribute(r, consistsOfMap)),
      operations: opResult.records.map((r) => mapOperation(r, paramRelMap)),
      capabilities: capResult.records.map((r) => r.get("capability") as string),
      ...pickDefined({
        description: rec.get("description"),
        stability: rec.get("stability"),
        parent: rec.get("parent"),
      }),
    } as BrowseResult;
  } finally {
    await Promise.all(sessions.map((s) => s.close()));
  }
}

// --- Record mapping ---

function mapAttribute(
  r: { get(key: string): unknown },
  consistsOfMap: Map<string, SubAttributeInfo[]>
): AttributeInfo {
  const name = r.get("name") as string;
  return {
    name,
    type: r.get("type") as string,
    description: r.get("description") as string,
    ...pickDefined({
      defaultValue: r.get("defaultValue"),
      accessType: r.get("accessType"),
      stability: r.get("stability"),
      required: r.get("required"),
      nillable: r.get("nillable"),
      expressionsAllowed: r.get("expressionsAllowed"),
      storage: r.get("storage"),
      allowed: r.get("allowed"),
      unit: r.get("unit"),
      restartRequired: r.get("restartRequired"),
      min: toNumberOrUndefined(r.get("min")),
      max: toNumberOrUndefined(r.get("max")),
      minLength: toNumberOrUndefined(r.get("minLength")),
      maxLength: toNumberOrUndefined(r.get("maxLength")),
      attributeGroup: r.get("attributeGroup"),
      valueType: r.get("valueType"),
      deprecatedSince: r.get("deprecatedSince"),
      deprecationReason: r.get("deprecationReason"),
      consistsOf: consistsOfMap.get(name),
    }),
  } as AttributeInfo;
}

function mapOperation(
  r: { get(key: string): unknown },
  paramRelMap: Map<string, { requires: string[]; alternatives: string[] }>
): OperationInfo {
  const opName = r.get("operation") as string;
  return {
    name: opName,
    description: r.get("description") as string,
    parameters: (r.get("parameters") as Array<Record<string, unknown> | null>)
      .filter((p): p is Record<string, unknown> => p != null)
      .map((p) => mapParameter(opName, p, paramRelMap)),
    ...pickDefined({
      stability: r.get("stability"),
      global: r.get("global"),
      readOnly: r.get("readOnly"),
      runtimeOnly: r.get("runtimeOnly"),
      returnValue: r.get("returnValue"),
      deprecatedSince: r.get("deprecatedSince"),
      deprecationReason: r.get("deprecationReason"),
    }),
  } as OperationInfo;
}

function mapParameter(
  opName: string,
  p: Record<string, unknown>,
  paramRelMap: Map<string, { requires: string[]; alternatives: string[] }>
): ParameterInfo {
  const rels = paramRelMap.get(`${opName}:${p.name}`);
  return {
    name: p.name as string,
    type: p.type as string,
    required: p.required as boolean,
    description: p.description as string,
    ...pickDefined({
      allowed: p.allowed,
      unit: p.unit,
      nillable: p.nillable,
      expressionsAllowed: p.expressionsAllowed,
      min: toNumberOrUndefined(p.min),
      max: toNumberOrUndefined(p.max),
      minLength: toNumberOrUndefined(p.minLength),
      maxLength: toNumberOrUndefined(p.maxLength),
      valueType: p.valueType,
      requires: rels?.requires,
      alternatives: rels?.alternatives,
    }),
  } as ParameterInfo;
}

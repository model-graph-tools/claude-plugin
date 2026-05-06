// Collects model graph statistics: node counts, stability breakdown per element type,
// deprecation counts, and relationship counts. Runs four parallel Cypher queries.

import { getSessions } from "../neo4j.js";
import { toNumber } from "../utils.js";

// --- Types ---

interface StabilityBreakdown {
  default: number;
  community: number;
  preview: number;
  experimental: number;
}

interface IdentityInfo {
  name: string;
  identifier: string;
  type: string;
  version: string;
  description: string;
  groupId?: string;
  artifactId?: string;
  url?: string;
  scmUrl?: string;
  licenses?: string;
}

interface StatisticsResult {
  identity?: IdentityInfo;
  resources: number;
  attributes: number;
  operations: number;
  parameters: number;
  capabilities: number;
  deprecated: {
    resources: number;
    attributes: number;
    operations: number;
  };
  stability: {
    resources: StabilityBreakdown;
    attributes: StabilityBreakdown;
    operations: StabilityBreakdown;
    parameters: StabilityBreakdown;
  };
  relationships: {
    childOf: number;
    hasAttribute: number;
    provides: number;
    accepts: number;
    declaresCapability: number;
    referencesCapability: number;
    requires: number;
    alternative: number;
    isSensitive: number;
    consistsOf: number;
    deprecatedSince: number;
  };
}

// --- Constants ---

const EMPTY_STABILITY: StabilityBreakdown = {
  default: 0,
  community: 0,
  preview: 0,
  experimental: 0,
};

const REL_TYPE_MAP: Record<string, keyof StatisticsResult["relationships"]> = {
  CHILD_OF: "childOf",
  HAS_ATTRIBUTE: "hasAttribute",
  PROVIDES: "provides",
  ACCEPTS: "accepts",
  DECLARES_CAPABILITY: "declaresCapability",
  REFERENCES_CAPABILITY: "referencesCapability",
  REQUIRES: "requires",
  ALTERNATIVE: "alternative",
  IS_SENSITIVE: "isSensitive",
  CONSISTS_OF: "consistsOf",
  DEPRECATED_SINCE: "deprecatedSince",
};

// --- Main ---

export async function getStatistics(
  identifier: string
): Promise<StatisticsResult> {
  const sessions = await getSessions(identifier, 4);
  try {
    const [nodeResult, deprecatedResult, relResult, identityResult] = await Promise.all([
      sessions[0].run(
        `MATCH (n)
         WHERE n:Resource OR n:Attribute OR n:Operation OR n:Parameter OR n:Capability
         WITH labels(n)[0] AS label, n.stability AS stability
         RETURN label, stability, count(*) AS cnt`
      ),
      sessions[1].run(
        `MATCH (r:Resource)-[:DEPRECATED_SINCE]->() RETURN 'resource' AS type, count(r) AS cnt
         UNION ALL
         MATCH (a:Attribute)-[:DEPRECATED_SINCE]->() RETURN 'attribute' AS type, count(a) AS cnt
         UNION ALL
         MATCH (o:Operation)-[:DEPRECATED_SINCE]->() RETURN 'operation' AS type, count(o) AS cnt`
      ),
      sessions[2].run(
        `MATCH ()-[r]->()
         RETURN type(r) AS relType, count(r) AS cnt`
      ),
      sessions[3].run(
        `OPTIONAL MATCH (i:Identity)
         RETURN i.name AS name, i.identifier AS identifier, i.type AS type,
                i.version AS version, i.description AS description,
                i.\`group-id\` AS groupId, i.\`artifact-id\` AS artifactId,
                i.url AS url, i.\`scm-url\` AS scmUrl, i.licenses AS licenses`
      ),
    ]);

    const counts: Record<string, number> = {
      Resource: 0,
      Attribute: 0,
      Operation: 0,
      Parameter: 0,
      Capability: 0,
    };
    const stabilityMap: Record<string, StabilityBreakdown> = {
      Resource: { ...EMPTY_STABILITY },
      Attribute: { ...EMPTY_STABILITY },
      Operation: { ...EMPTY_STABILITY },
      Parameter: { ...EMPTY_STABILITY },
    };

    for (const r of nodeResult.records) {
      const label = r.get("label") as string;
      const stability = r.get("stability") as string | null;
      const cnt = toNumber(r.get("cnt"));
      counts[label] = (counts[label] ?? 0) + cnt;
      if (stability && label in stabilityMap) {
        const breakdown = stabilityMap[label];
        if (stability in breakdown) {
          breakdown[stability as keyof StabilityBreakdown] += cnt;
        }
      }
    }

    const deprecated = { resources: 0, attributes: 0, operations: 0 };
    for (const r of deprecatedResult.records) {
      const type = r.get("type") as string;
      const cnt = toNumber(r.get("cnt"));
      if (type === "resource") deprecated.resources = cnt;
      else if (type === "attribute") deprecated.attributes = cnt;
      else if (type === "operation") deprecated.operations = cnt;
    }

    const relationships: StatisticsResult["relationships"] = {
      childOf: 0,
      hasAttribute: 0,
      provides: 0,
      accepts: 0,
      declaresCapability: 0,
      referencesCapability: 0,
      requires: 0,
      alternative: 0,
      isSensitive: 0,
      consistsOf: 0,
      deprecatedSince: 0,
    };
    for (const r of relResult.records) {
      const relType = r.get("relType") as string;
      const cnt = toNumber(r.get("cnt"));
      const key = REL_TYPE_MAP[relType];
      if (key) relationships[key] = cnt;
    }

    let identity: IdentityInfo | undefined;
    if (identityResult.records.length > 0) {
      const ir = identityResult.records[0];
      const name = ir.get("name");
      if (name != null) {
        identity = {
          name: name as string,
          identifier: ir.get("identifier") as string,
          type: ir.get("type") as string,
          version: ir.get("version") as string,
          description: ir.get("description") as string,
        };
        const groupId = ir.get("groupId");
        if (groupId != null) identity.groupId = groupId as string;
        const artifactId = ir.get("artifactId");
        if (artifactId != null) identity.artifactId = artifactId as string;
        const url = ir.get("url");
        if (url != null) identity.url = url as string;
        const scmUrl = ir.get("scmUrl");
        if (scmUrl != null) identity.scmUrl = scmUrl as string;
        const licenses = ir.get("licenses");
        if (licenses != null) identity.licenses = licenses as string;
      }
    }

    return {
      identity,
      resources: counts.Resource,
      attributes: counts.Attribute,
      operations: counts.Operation,
      parameters: counts.Parameter,
      capabilities: counts.Capability,
      deprecated,
      stability: {
        resources: stabilityMap.Resource,
        attributes: stabilityMap.Attribute,
        operations: stabilityMap.Operation,
        parameters: stabilityMap.Parameter,
      },
      relationships,
    };
  } finally {
    await Promise.all(sessions.map((s) => s.close()));
  }
}

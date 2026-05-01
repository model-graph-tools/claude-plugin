import { mgtVersions, mgtFeaturePacks, mgtPs } from "../mgt.js";
import { getActiveSource, registerConnection } from "../neo4j.js";

interface SourceInfo {
  identifier: string;
  type: "wildfly" | "feature-pack";
  name: string;
  version: string;
  status: "running" | "stopped" | "not_found";
  active: boolean;
  bolt?: number;
  http?: number;
}

interface ListSourcesResult {
  activeSource: string | null;
  sources: SourceInfo[];
}

export async function listSources(): Promise<ListSourcesResult> {
  const [versions, featurePacks, running] = await Promise.all([
    mgtVersions(),
    mgtFeaturePacks(),
    mgtPs(),
  ]);

  const runningByIdentifier = new Map(
    running.map((c) => [c.identifier, c])
  );

  const active = getActiveSource();
  const sources: SourceInfo[] = [];

  for (const v of versions) {
    const container = runningByIdentifier.get(v.short_version);
    if (container) {
      registerConnection(v.short_version, container.bolt);
    }
    sources.push({
      identifier: v.short_version,
      type: "wildfly",
      name: `WildFly ${v.short_version}`,
      version: v.version,
      status: container ? "running" : "not_found",
      active: v.short_version === active,
      bolt: container?.bolt,
      http: container?.http,
    });
  }

  const seen = new Set<string>();
  for (const fp of featurePacks) {
    const id = `${fp.shortcut}:${fp.version}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const container = runningByIdentifier.get(id);
    if (container) {
      registerConnection(id, container.bolt);
    }
    sources.push({
      identifier: id,
      type: "feature-pack",
      name: `${fp.name} ${fp.version}`,
      version: fp.version,
      status: container ? "running" : "not_found",
      active: id === active,
      bolt: container?.bolt,
      http: container?.http,
    });
  }

  return { activeSource: active, sources };
}

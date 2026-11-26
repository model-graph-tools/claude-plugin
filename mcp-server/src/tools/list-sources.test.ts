import { describe, it, expect, vi, beforeEach } from "vite-plus/test";

vi.mock("../mgt.js", () => ({
  mgtVersions: vi.fn(),
  mgtFeaturePacks: vi.fn(),
  mgtPs: vi.fn(),
}));

vi.mock("../neo4j.js", () => ({
  getActiveSource: vi.fn().mockReturnValue(null),
  ensureConnection: vi.fn(),
}));

import { listSources, latestWildFlyVersion } from "./list-sources.js";
import { mgtVersions, mgtFeaturePacks, mgtPs } from "../mgt.js";

const mockVersions = vi.mocked(mgtVersions);
const mockFeaturePacks = vi.mocked(mgtFeaturePacks);
const mockPs = vi.mocked(mgtPs);

const VERSIONS = [
  { identifier: 390, version: "39.0.0", short_version: "39.0" },
  { identifier: 420, version: "42.0.0", short_version: "42.0" },
  { identifier: 100, version: "10.0.0", short_version: "10.0" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockVersions.mockResolvedValue(VERSIONS);
  mockFeaturePacks.mockResolvedValue([]);
});

describe("latestWildFlyVersion", () => {
  it("returns the short version with the highest identifier", () => {
    expect(latestWildFlyVersion(VERSIONS)).toBe("42.0");
  });

  it("returns undefined for an empty list", () => {
    expect(latestWildFlyVersion([])).toBeUndefined();
  });
});

describe("listSources", () => {
  it("includes a start_source hint for the latest WildFly when nothing is running", async () => {
    mockPs.mockResolvedValue([]);

    const result = await listSources();

    expect(result.hint).toContain("No model graph is running");
    expect(result.hint).toContain('start_source with identifier="42.0"');
  });

  it("omits the hint when a model graph is running", async () => {
    mockPs.mockResolvedValue([{ identifier: "39.0", bolt: 7687, http: 7474 }] as never);

    const result = await listSources();

    expect(result.hint).toBeUndefined();
    expect(result.sources.find((s) => s.identifier === "39.0")?.status).toBe("running");
  });

  it("omits the hint when no WildFly versions are known", async () => {
    mockVersions.mockResolvedValue([]);
    mockPs.mockResolvedValue([]);

    const result = await listSources();

    expect(result.hint).toBeUndefined();
  });
});

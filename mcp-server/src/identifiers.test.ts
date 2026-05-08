import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveIdentifier, resolveIdentifiers } from "./identifiers.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => fn,
}));

import { execFile } from "node:child_process";
const mockExecFile = vi.mocked(execFile);

function mockResolve(results: Array<{ identifier: string; source_type: string; name: string }>) {
  mockExecFile.mockImplementation((() =>
    Promise.resolve({ stdout: JSON.stringify(results), stderr: "" })) as never);
}

function mockError(stderr: string) {
  const error = Object.assign(new Error("Command failed"), { stderr });
  mockExecFile.mockImplementation((() => Promise.reject(error)) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveIdentifier", () => {
  it("resolves major-only WildFly version", async () => {
    mockResolve([{ identifier: "39.0", source_type: "wildfly", name: "WildFly 39.0" }]);

    const result = await resolveIdentifier("39");
    expect(result).toBe("39.0");
    expect(mockExecFile).toHaveBeenCalledWith("mgt", ["resolve", "39", "--json"], { timeout: 30000 });
  });

  it("resolves already-canonical WildFly version", async () => {
    mockResolve([{ identifier: "39.0", source_type: "wildfly", name: "WildFly 39.0" }]);

    const result = await resolveIdentifier("39.0");
    expect(result).toBe("39.0");
  });

  it("resolves minor WildFly version", async () => {
    mockResolve([{ identifier: "26.1", source_type: "wildfly", name: "WildFly 26.1" }]);

    const result = await resolveIdentifier("26.1");
    expect(result).toBe("26.1");
  });

  it("resolves feature pack shortcut to latest version", async () => {
    mockResolve([{ identifier: "ai:0.9.1", source_type: "feature-pack", name: "AI Feature Pack 0.9.1" }]);

    const result = await resolveIdentifier("ai");
    expect(result).toBe("ai:0.9.1");
  });

  it("resolves exact feature pack version", async () => {
    mockResolve([{ identifier: "ai:0.9.0", source_type: "feature-pack", name: "AI Feature Pack 0.9.0" }]);

    const result = await resolveIdentifier("ai:0.9.0");
    expect(result).toBe("ai:0.9.0");
  });

  it("throws on invalid identifier", async () => {
    mockError("Unknown identifier: unknown");

    await expect(resolveIdentifier("unknown")).rejects.toThrow(
      "mgt resolve failed: Unknown identifier: unknown"
    );
  });

  it("throws when mgt is not found", async () => {
    const error = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockExecFile.mockImplementation((() => Promise.reject(error)) as never);

    await expect(resolveIdentifier("39")).rejects.toThrow("mgt CLI not found");
  });
});

describe("resolveIdentifiers", () => {
  it("resolves two identifiers in parallel", async () => {
    mockResolve([
      { identifier: "38.0", source_type: "wildfly", name: "WildFly 38.0" },
      { identifier: "39.0", source_type: "wildfly", name: "WildFly 39.0" },
    ]);

    const [id1, id2] = await resolveIdentifiers("38", "39");
    expect(id1).toBe("38.0");
    expect(id2).toBe("39.0");
    expect(mockExecFile).toHaveBeenCalledWith("mgt", ["resolve", "38,39", "--json"], { timeout: 30000 });
  });

  it("resolves mixed WildFly and feature pack identifiers", async () => {
    mockResolve([
      { identifier: "39.0", source_type: "wildfly", name: "WildFly 39.0" },
      { identifier: "ai:0.9.1", source_type: "feature-pack", name: "AI Feature Pack 0.9.1" },
    ]);

    const [id1, id2] = await resolveIdentifiers("39", "ai");
    expect(id1).toBe("39.0");
    expect(id2).toBe("ai:0.9.1");
  });
});

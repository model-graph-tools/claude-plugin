import { describe, it, expect, vi, beforeEach } from "vitest";
import { mgtVersions, mgtFeaturePacks, mgtPs, mgtStart, mgtStop } from "./mgt.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => fn,
}));

import { execFile } from "node:child_process";
const mockExecFile = vi.mocked(execFile);

function mockSuccess(stdout: string) {
  mockExecFile.mockImplementation((() =>
    Promise.resolve({ stdout, stderr: "" })) as never);
}

function mockError(overrides: Record<string, unknown>) {
  const error = Object.assign(new Error("Command failed"), overrides);
  mockExecFile.mockImplementation((() => Promise.reject(error)) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mgtVersions", () => {
  it("parses JSON output", async () => {
    const versions = [{ identifier: 39, version: "39.0.0.Final", short_version: "39.0" }];
    mockSuccess(JSON.stringify(versions));

    const result = await mgtVersions();
    expect(result).toEqual(versions);
    expect(mockExecFile).toHaveBeenCalledWith(
      "mgt", ["versions", "--json"], { timeout: 30000 }
    );
  });
});

describe("mgtFeaturePacks", () => {
  it("parses JSON output", async () => {
    const packs = [{ shortcut: "ai", name: "AI Feature Pack", version: "0.9.1" }];
    mockSuccess(JSON.stringify(packs));

    const result = await mgtFeaturePacks();
    expect(result).toEqual(packs);
    expect(mockExecFile).toHaveBeenCalledWith(
      "mgt", ["feature-packs", "--json"], { timeout: 30000 }
    );
  });
});

describe("mgtPs", () => {
  it("parses JSON output", async () => {
    const containers = [{
      identifier: "39.0", source_type: "wildfly", name: "WildFly 39.0",
      container_name: "mgt-39", bolt: 7687, http: 7474, status: "running", id: "abc123"
    }];
    mockSuccess(JSON.stringify(containers));

    const result = await mgtPs();
    expect(result).toEqual(containers);
  });
});

describe("mgtStart", () => {
  it("returns first result on success", async () => {
    const results = [{
      identifier: "39.0", success: true, bolt: 7687, http: 7474
    }];
    mockSuccess(JSON.stringify(results));

    const result = await mgtStart("39");
    expect(result).toEqual(results[0]);
    expect(mockExecFile).toHaveBeenCalledWith(
      "mgt", ["start", "39", "--json"], { timeout: 300000 }
    );
  });

  it("throws on empty results", async () => {
    mockSuccess("[]");

    await expect(mgtStart("39")).rejects.toThrow(
      'mgt start returned no results for "39"'
    );
  });
});

describe("mgtStop", () => {
  it("returns first result on success", async () => {
    const results = [{ identifier: "39.0", success: true }];
    mockSuccess(JSON.stringify(results));

    const result = await mgtStop("39.0");
    expect(result).toEqual(results[0]);
  });

  it("throws on empty results", async () => {
    mockSuccess("[]");

    await expect(mgtStop("39.0")).rejects.toThrow(
      'mgt stop returned no results for "39.0"'
    );
  });
});

describe("runMgt error handling", () => {
  it("throws user-friendly message when mgt is not found", async () => {
    mockError({ code: "ENOENT" });

    await expect(mgtVersions()).rejects.toThrow(
      "mgt CLI not found on PATH"
    );
  });

  it("throws timeout message on SIGTERM", async () => {
    mockError({ killed: true, signal: "SIGTERM" });

    await expect(mgtVersions()).rejects.toThrow(
      "mgt versions timed out after 30s"
    );
  });

  it("detects Docker daemon not running", async () => {
    mockError({ stderr: "Cannot connect to the Docker daemon" });

    await expect(mgtVersions()).rejects.toThrow(
      "Docker does not appear to be running"
    );
  });

  it("detects permission denied", async () => {
    mockError({ stderr: "Permission denied while trying to connect" });

    await expect(mgtVersions()).rejects.toThrow(
      "Permission denied"
    );
  });

  it("detects disk space issues", async () => {
    mockError({ stderr: "no space left on device" });

    await expect(mgtVersions()).rejects.toThrow(
      "No disk space available"
    );
  });

  it("falls back to raw stderr for unknown errors", async () => {
    mockError({ stderr: "something unexpected happened" });

    await expect(mgtVersions()).rejects.toThrow(
      "mgt versions failed: something unexpected happened"
    );
  });

  it("rethrows non-Error exceptions", async () => {
    mockExecFile.mockImplementation((() =>
      Promise.reject("string error")) as never);

    await expect(mgtVersions()).rejects.toBe("string error");
  });
});

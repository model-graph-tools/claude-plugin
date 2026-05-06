import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../mgt.js", () => ({
  mgtStart: vi.fn(),
  mgtStop: vi.fn().mockResolvedValue({ identifier: "39.0", success: true }),
  mgtPs: vi.fn().mockResolvedValue([]),
}));

vi.mock("../neo4j.js", () => ({
  refreshConnection: vi.fn(),
  waitForReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../session.js", () => ({
  trackStarted: vi.fn(),
}));

import { startSource } from "./start-source.js";
import { mgtStart, mgtStop, mgtPs } from "../mgt.js";
import { refreshConnection, waitForReady } from "../neo4j.js";
import { trackStarted } from "../session.js";

const mockMgtStart = vi.mocked(mgtStart);
const mockMgtPs = vi.mocked(mgtPs);
const mockRefreshConnection = vi.mocked(refreshConnection);
const mockWaitForReady = vi.mocked(waitForReady);
const mockTrackStarted = vi.mocked(trackStarted);
const mockMgtStop = vi.mocked(mgtStop);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startSource", () => {
  it("returns success when mgtStart succeeds and Neo4j is ready", async () => {
    mockMgtStart.mockResolvedValue({
      identifier: "39.0",
      success: true,
      bolt: 7687,
      http: 7474,
    });

    const result = await startSource("39.0");

    expect(result.status).toBe("running");
    expect(result.bolt).toBe(7687);
    expect(result.http).toBe(7474);
    expect(mockRefreshConnection).toHaveBeenCalledWith("39.0", 7687);
    expect(mockWaitForReady).toHaveBeenCalledWith("39.0");
    expect(mockTrackStarted).toHaveBeenCalledWith("39.0");
  });

  it("uses canonical identifier from mgt start result", async () => {
    mockMgtStart.mockResolvedValue({
      identifier: "39.0",
      success: true,
      bolt: 7687,
      http: 7474,
    });

    const result = await startSource("39");

    expect(result.identifier).toBe("39.0");
    expect(mockRefreshConnection).toHaveBeenCalledWith("39.0", 7687);
  });

  it("handles already-running container", async () => {
    mockMgtStart.mockResolvedValue({
      identifier: "39.0",
      success: false,
      error: "Failed to start Neo4J: container name conflict",
      error_code: "CONTAINER_START_FAILED",
    });
    mockMgtPs.mockResolvedValue([{
      identifier: "39.0",
      source_type: "wildfly",
      name: "WildFly 39.0",
      container_name: "mgt-39",
      bolt: 7687,
      http: 7474,
      status: "running",
      id: "abc123",
    }]);

    const result = await startSource("39.0");

    expect(result.status).toBe("running");
    expect(result.bolt).toBe(7687);
    expect(result.message).toContain("already running");
    expect(mockRefreshConnection).toHaveBeenCalledWith("39.0", 7687);
    expect(mockWaitForReady).toHaveBeenCalledWith("39.0");
  });

  it("does not track already-running containers for shutdown", async () => {
    mockMgtStart.mockResolvedValue({
      identifier: "39.0",
      success: false,
      error: "container conflict",
    });
    mockMgtPs.mockResolvedValue([{
      identifier: "39.0",
      source_type: "wildfly",
      name: "WildFly 39.0",
      container_name: "mgt-39",
      bolt: 7687,
      http: 7474,
      status: "running",
      id: "abc123",
    }]);

    await startSource("39.0");

    expect(mockTrackStarted).not.toHaveBeenCalled();
  });

  it("throws when mgtStart fails and container not running", async () => {
    mockMgtStart.mockResolvedValue({
      identifier: "99.0",
      success: false,
      error: "Failed to pull image",
    });
    mockMgtPs.mockResolvedValue([]);

    await expect(startSource("99.0")).rejects.toThrow(
      "Failed to pull image"
    );
  });

  it("rolls back on waitForReady failure", async () => {
    mockMgtStart.mockResolvedValue({
      identifier: "39.0",
      success: true,
      bolt: 7687,
      http: 7474,
    });
    mockWaitForReady.mockRejectedValueOnce(new Error("Neo4j not ready"));

    await expect(startSource("39.0")).rejects.toThrow("Neo4j not ready");
    expect(mockMgtStop).toHaveBeenCalledWith("39.0");
  });

  it("throws when mgtStart succeeds but ports are missing", async () => {
    mockMgtStart.mockResolvedValue({
      identifier: "39.0",
      success: true,
    });

    await expect(startSource("39.0")).rejects.toThrow(
      "did not return port information"
    );
  });
});

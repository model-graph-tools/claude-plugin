import neo4j, { type Driver, type Session } from "neo4j-driver";

interface ConnectionEntry {
  driver: Driver;
  boltPort: number;
}

const VERIFY_INTERVAL_MS = 30_000;
const connections = new Map<string, ConnectionEntry>();
const lastVerified = new Map<string, number>();
let activeSource: string | null = null;

function createDriver(boltPort: number): Driver {
  return neo4j.driver(`bolt://localhost:${boltPort}`, undefined, {
    maxConnectionPoolSize: 5,
    connectionAcquisitionTimeout: 5000,
  });
}

export function refreshConnection(identifier: string, boltPort: number): Driver {
  const existing = connections.get(identifier);
  if (existing) {
    existing.driver.close().catch(() => {});
  }
  lastVerified.delete(identifier);
  const driver = createDriver(boltPort);
  connections.set(identifier, { driver, boltPort });
  return driver;
}

export function hasConnection(identifier: string): boolean {
  return connections.has(identifier);
}

export async function getSession(identifier: string): Promise<Session> {
  const entry = connections.get(identifier);
  if (!entry) {
    throw new Error(
      `No connection for source "${identifier}". Use start_source to start it first.`
    );
  }

  const now = Date.now();
  const lastCheck = lastVerified.get(identifier) ?? 0;
  if (now - lastCheck > VERIFY_INTERVAL_MS) {
    try {
      await entry.driver.verifyConnectivity();
      lastVerified.set(identifier, now);
    } catch {
      entry.driver.close().catch(() => {});
      const freshDriver = createDriver(entry.boltPort);
      connections.set(identifier, { driver: freshDriver, boltPort: entry.boltPort });
      try {
        await freshDriver.verifyConnectivity();
        lastVerified.set(identifier, Date.now());
      } catch {
        connections.delete(identifier);
        lastVerified.delete(identifier);
        throw new Error(
          `Cannot connect to source "${identifier}" at bolt://localhost:${entry.boltPort}. ` +
            `The container may not be running or Neo4j may not be ready. Use start_source to reconnect.`
        );
      }
    }
  }

  activeSource = identifier;
  return connections.get(identifier)!.driver.session({
    defaultAccessMode: neo4j.session.READ,
  });
}

export function getActiveSource(): string | null {
  return activeSource;
}

export function clearActiveSource(): void {
  activeSource = null;
}

export async function closeConnection(identifier: string): Promise<void> {
  const entry = connections.get(identifier);
  if (entry) {
    await entry.driver.close();
    connections.delete(identifier);
    lastVerified.delete(identifier);
    if (activeSource === identifier) {
      activeSource = null;
    }
  }
}

export async function closeAll(): Promise<void> {
  const closePromises = Array.from(connections.values()).map((e) =>
    e.driver.close()
  );
  await Promise.all(closePromises);
  connections.clear();
  lastVerified.clear();
}

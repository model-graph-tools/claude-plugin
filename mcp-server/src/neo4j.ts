import neo4j, { type Driver, type Session } from "neo4j-driver";

const connections = new Map<string, Driver>();
let activeSource: string | null = null;

export function getDriver(identifier: string, boltPort: number): Driver {
  const existing = connections.get(identifier);
  if (existing) {
    return existing;
  }
  const driver = neo4j.driver(
    `bolt://localhost:${boltPort}`,
    undefined,
    { maxConnectionPoolSize: 5, connectionAcquisitionTimeout: 5000 }
  );
  connections.set(identifier, driver);
  return driver;
}

export function hasConnection(identifier: string): boolean {
  return connections.has(identifier);
}

export function getSession(identifier: string): Session {
  const driver = connections.get(identifier);
  if (!driver) {
    throw new Error(
      `No connection for source "${identifier}". Use start_source to start it first.`
    );
  }
  activeSource = identifier;
  return driver.session({ defaultAccessMode: neo4j.session.READ });
}

export function getActiveSource(): string | null {
  return activeSource;
}

export function clearActiveSource(): void {
  activeSource = null;
}

export async function closeConnection(identifier: string): Promise<void> {
  const driver = connections.get(identifier);
  if (driver) {
    await driver.close();
    connections.delete(identifier);
    if (activeSource === identifier) {
      activeSource = null;
    }
  }
}

export async function closeAll(): Promise<void> {
  const closePromises = Array.from(connections.values()).map((d) => d.close());
  await Promise.all(closePromises);
  connections.clear();
}

export function registerConnection(
  identifier: string,
  boltPort: number
): Driver {
  return getDriver(identifier, boltPort);
}

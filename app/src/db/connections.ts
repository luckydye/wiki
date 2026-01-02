import { eq } from "drizzle-orm";
import { getSpaceDb } from "./db.js";
import { connection } from "./schema/space.js";

export interface Connection {
  id: string;
  label: string;
  url?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function createConnection(
  spaceId: string,
  label: string,
  url?: string,
  icon?: string,
): Promise<Connection> {
  const db = getSpaceDb(spaceId);
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(connection).values({
    id,
    label,
    url: url || null,
    icon: icon || null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    label,
    url,
    icon,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getConnection(
  spaceId: string,
  id: string,
): Promise<Connection | null> {
  const db = getSpaceDb(spaceId);
  const result = await db.select().from(connection).where(eq(connection.id, id)).get();

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    label: result.label,
    url: result.url || undefined,
    icon: result.icon || undefined,
    createdAt: new Date(result.createdAt),
    updatedAt: new Date(result.updatedAt),
  };
}

export async function listConnections(spaceId: string): Promise<Connection[]> {
  const db = getSpaceDb(spaceId);
  const results = await db.select().from(connection).all();

  return results.map((result) => ({
    id: result.id,
    label: result.label,
    url: result.url || undefined,
    icon: result.icon || undefined,
    createdAt: new Date(result.createdAt),
    updatedAt: new Date(result.updatedAt),
  }));
}

export async function updateConnection(
  spaceId: string,
  id: string,
  label: string,
  url?: string,
  icon?: string,
): Promise<Connection | null> {
  const db = getSpaceDb(spaceId);
  const existing = await getConnection(spaceId, id);

  if (!existing) {
    return null;
  }

  const now = new Date();

  await db
    .update(connection)
    .set({
      label,
      url: url || null,
      icon: icon || null,
      updatedAt: now,
    })
    .where(eq(connection.id, id));

  return {
    id,
    label,
    url,
    icon,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
}

export async function deleteConnection(spaceId: string, id: string): Promise<boolean> {
  const db = getSpaceDb(spaceId);
  await db.delete(connection).where(eq(connection.id, id));
  return true;
}

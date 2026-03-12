import { db } from "../db";

export async function getMemory<T = unknown>(agentId: string, key: string): Promise<T | null> {
  const mem = await db.agentMemory.findUnique({
    where: { agentId_key: { agentId, key } },
  });
  if (!mem) return null;
  try {
    return JSON.parse(mem.value) as T;
  } catch {
    return mem.value as unknown as T;
  }
}

export async function setMemory(agentId: string, key: string, value: unknown): Promise<void> {
  await db.agentMemory.upsert({
    where: { agentId_key: { agentId, key } },
    update: { value: JSON.stringify(value) },
    create: { agentId, key, value: JSON.stringify(value) },
  });
}

export async function deleteMemory(agentId: string, key: string): Promise<void> {
  await db.agentMemory.deleteMany({
    where: { agentId, key },
  });
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export const getDb = cache(() => {
  const { env } = getCloudflareContext();
  const connectionString = env.HYPERDRIVE.connectionString;
  const adapter = new PrismaPg({ connectionString, maxUses: 1 });
  return new PrismaClient({ adapter });
});

export const getDbAsync = async () => {
  const { env } = await getCloudflareContext({ async: true });
  const connectionString = env.HYPERDRIVE.connectionString;
  const adapter = new PrismaPg({ connectionString, maxUses: 1 });
  return new PrismaClient({ adapter });
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

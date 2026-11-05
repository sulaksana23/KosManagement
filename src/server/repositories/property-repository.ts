import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { properties } from "@/db/schema";

/** Temukan properti hanya dalam workspace dari sesi server yang sudah diverifikasi. */
export async function findWorkspaceProperty(organizationId: string, propertyId: string) {
  const [property] = await db.select().from(properties).where(and(
    eq(properties.id, propertyId),
    eq(properties.organizationId, organizationId),
  )).limit(1);
  return property;
}

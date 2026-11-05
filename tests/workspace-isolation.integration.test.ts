import assert from "node:assert/strict";
import test from "node:test";
import { inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import { organizations, properties } from "../src/db/schema";
import { findWorkspaceProperty } from "../src/server/repositories/property-repository";

test("repository properti hanya mengembalikan baris dari workspace yang diminta", {
  skip: process.env.RUN_DB_INTEGRATION_TESTS !== "1",
}, async () => {
  const organizationA = crypto.randomUUID();
  const organizationB = crypto.randomUUID();
  const propertyA = crypto.randomUUID();
  const propertyB = crypto.randomUUID();
  try {
    await db.insert(organizations).values([
      { id: organizationA, name: "Tes Workspace A" },
      { id: organizationB, name: "Tes Workspace B" },
    ]);
    await db.insert(properties).values([
      { id: propertyA, organizationId: organizationA, name: "Properti A", address: "Alamat A" },
      { id: propertyB, organizationId: organizationB, name: "Properti B", address: "Alamat B" },
    ]);
    const ownRecord = await findWorkspaceProperty(organizationA, propertyA);
    const otherWorkspaceRecord = await findWorkspaceProperty(organizationA, propertyB);
    assert.equal(ownRecord?.id, propertyA);
    assert.equal(otherWorkspaceRecord, undefined);
  } finally {
    await db.delete(organizations).where(inArray(organizations.id, [organizationA, organizationB]));
    await pool.end();
  }
});

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "@/db";
import { auth } from "@/lib/auth";
import { id, todayISO } from "@/lib/format";
import { authUsers, leases, members, organizations, properties, rooms, tenants } from "@/db/schema";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed hanya boleh dijalankan di development.");
  const email = z.email().safeParse(process.env.SEED_OWNER_EMAIL);
  const password = z.string().min(10).max(128).safeParse(process.env.SEED_OWNER_PASSWORD);
  if (!email.success || !password.success) throw new Error("Atur SEED_OWNER_EMAIL dan SEED_OWNER_PASSWORD untuk membuat akun demo development.");

  let user = (await db.select().from(authUsers).where(eq(authUsers.email, email.data)).limit(1))[0];
  if (!user) {
    const result = await auth.api.signUpEmail({ body: { name: "Pemilik Demo", email: email.data, password: password.data } });
    user = (await db.select().from(authUsers).where(eq(authUsers.id, result.user.id)).limit(1))[0];
  }
  if (!user) throw new Error("Akun demo gagal dibuat.");

  let membership = (await db.select().from(members).where(eq(members.userId, user.id)).limit(1))[0];
  if (!membership) {
    const organizationId = id();
    await db.transaction(async (tx) => {
      await tx.insert(organizations).values({ id: organizationId, name: "Kos Demo" });
      await tx.insert(members).values({ id: id(), organizationId, userId: user.id, role: "owner" });
    });
    membership = (await db.select().from(members).where(and(eq(members.userId, user.id), eq(members.organizationId, organizationId))).limit(1))[0];
  }
  if (!membership) throw new Error("Workspace demo gagal dibuat.");

  const existingProperty = (await db.select().from(properties).where(and(eq(properties.organizationId, membership.organizationId), eq(properties.name, "Kos Melati Demo"))).limit(1))[0];
  if (existingProperty) {
    console.log("Data contoh sudah tersedia; tidak ada data yang diubah.");
    return;
  }

  const propertyId = id(), tenantId = id(), roomA = id(), roomB = id(), leaseId = id();
  const today = todayISO();
  await db.transaction(async (tx) => {
    await tx.insert(properties).values({ id: propertyId, organizationId: membership.organizationId, name: "Kos Melati Demo", address: "Jl. Contoh No. 10, Bangli", timezone: "Asia/Makassar" });
    await tx.insert(rooms).values([
      { id: roomA, organizationId: membership.organizationId, propertyId, code: "A-01", floor: "1", type: "Standard", monthlyRent: "1200000", deposit: "500000", status: "occupied" },
      { id: roomB, organizationId: membership.organizationId, propertyId, code: "A-02", floor: "1", type: "Standard", monthlyRent: "1200000", deposit: "500000", status: "available" },
    ]);
    await tx.insert(tenants).values({ id: tenantId, organizationId: membership.organizationId, fullName: "Rina Pratiwi", phone: "081200000001", email: "rina@example.test" });
    await tx.insert(leases).values({ id: leaseId, organizationId: membership.organizationId, tenantId, roomId: roomA, startsAt: today, monthlyRent: "1200000", deposit: "500000", dueDay: 5, status: "active" });
  });
  console.log(`Data demo siap untuk ${email.data}. Masuk dengan password development yang Anda atur.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed gagal.");
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});

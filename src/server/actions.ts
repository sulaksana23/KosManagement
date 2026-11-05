"use server";

import { and, count, eq, gte, gt, isNull, lte, or, sql, sum } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  auditLogs,
  authUsers,
  expenses,
  invitations,
  invoiceItems,
  invoices,
  leases,
  maintenanceComments,
  maintenanceTickets,
  members,
  organizations,
  properties,
  rooms,
  tenants,
  utilityReadings,
  payments,
  planRequests,
} from "@/db/schema";
import { getServerSession, requireTenantWorkspace, requireUser, requireWorkspace } from "@/server/context";
import { id, monthRange, todayISO } from "@/lib/format";
import { PLAN_LIMITS } from "@/lib/plans";
import { requirePlatformAdmin } from "@/server/platform-admin";

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const money = z.string().regex(/^\d{1,14}$/, "Masukkan nominal rupiah berupa angka bulat.");
const positiveMoney = money.refine((amount) => /^\d{1,14}$/.test(amount) && /[1-9]/.test(amount), "Nominal harus lebih dari nol.");

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function go(path: string, key: "notice" | "error", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function audit(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: Record<string, unknown>,
) {
  await tx.insert(auditLogs).values({
    id: id(), organizationId, actorUserId, action, entityType, entityId,
    changes: changes ?? null,
  });
}

export async function createWorkspace(form: FormData) {
  const session = await requireUser();
  const name = requiredText(100).safeParse(value(form, "name"));
  if (!name.success) go("/setup", "error", "Nama workspace minimal 1 karakter.");

  const [existing] = await db.select({ id: members.id }).from(members).where(eq(members.userId, session.user.id)).limit(1);
  if (existing) redirect("/dashboard");

  const organizationId = id();
  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({ id: organizationId, name: name.data });
    await tx.insert(members).values({ id: id(), organizationId, userId: session.user.id, role: "owner" });
    await audit(tx, organizationId, session.user.id, "workspace.created", "organization", organizationId);
  });
  redirect("/dashboard");
}

export async function createInvitation(_previousState: { error?: string; inviteLink?: string }, form: FormData): Promise<{ error?: string; inviteLink?: string }> {
  const ctx = await requireWorkspace(["owner"]);
  const parsed = z.object({ email: z.email(), role: z.enum(["manager", "finance", "staff"]) }).safeParse({
    email: value(form, "email").toLowerCase(), role: value(form, "role"),
  });
  if (!parsed.success) return { error: "Masukkan email yang valid dan pilih peran." };
  const [existing] = await db.select({ id: members.id }).from(members).innerJoin(authUsers, eq(members.userId, authUsers.id))
    .where(and(eq(members.organizationId, ctx.organizationId), eq(authUsers.email, parsed.data.email))).limit(1);
  if (existing) return { error: "Email tersebut sudah menjadi anggota workspace." };
  const [pending] = await db.select({ id: invitations.id }).from(invitations).where(and(
    eq(invitations.organizationId, ctx.organizationId), eq(invitations.email, parsed.data.email), isNull(invitations.acceptedAt), gte(invitations.expiresAt, new Date()),
  )).limit(1);
  if (pending) return { error: "Undangan aktif untuk email tersebut sudah tersedia." };
  const token = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const invitationId = id();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    await db.transaction(async (tx) => {
      const [organization] = await tx.select({ plan: organizations.plan }).from(organizations)
        .where(eq(organizations.id, ctx.organizationId)).for("update").limit(1);
      if (!organization) throw new Error("WORKSPACE_NOT_FOUND");

      const [existingMember] = await tx.select({ id: members.id }).from(members).innerJoin(authUsers, eq(members.userId, authUsers.id))
        .where(and(eq(members.organizationId, ctx.organizationId), eq(authUsers.email, parsed.data.email))).limit(1);
      if (existingMember) throw new Error("INVITATION_MEMBER_EXISTS");
      const [activeInvitation] = await tx.select({ id: invitations.id }).from(invitations).where(and(
        eq(invitations.organizationId, ctx.organizationId), eq(invitations.email, parsed.data.email),
        isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()),
      )).limit(1);
      if (activeInvitation) throw new Error("INVITATION_ALREADY_PENDING");

      const memberLimit = PLAN_LIMITS[organization.plan].members;
      if (memberLimit !== null) {
        const [memberCount] = await tx.select({ total: count() }).from(members)
          .where(eq(members.organizationId, ctx.organizationId));
        const [invitationCount] = await tx.select({ total: count() }).from(invitations).where(and(
          eq(invitations.organizationId, ctx.organizationId), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()),
        ));
        if (memberCount.total + invitationCount.total >= memberLimit) throw new Error("FREE_LIMIT_MEMBERS");
      }

      await tx.insert(invitations).values({ id: invitationId, organizationId: ctx.organizationId, email: parsed.data.email, role: parsed.data.role, tokenHash: await tokenHash(token), expiresAt, createdBy: ctx.userId });
      await audit(tx, ctx.organizationId, ctx.userId, "invitation.created", "invitation", invitationId, { email: parsed.data.email, role: parsed.data.role, expiresAt });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FREE_LIMIT_MEMBERS") return { error: "Kuota Paket Free adalah 3 anggota, termasuk pemilik dan undangan aktif. Ajukan upgrade ke Pro untuk menambah anggota." };
    if (error instanceof Error && error.message === "INVITATION_MEMBER_EXISTS") return { error: "Email tersebut sudah menjadi anggota workspace." };
    if (error instanceof Error && error.message === "INVITATION_ALREADY_PENDING") return { error: "Undangan aktif untuk email tersebut sudah tersedia." };
    return { error: "Undangan gagal dibuat. Coba lagi." };
  }
  revalidatePath("/team");
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { error: undefined, inviteLink: `${baseUrl}/invite?token=${encodeURIComponent(token)}` };
}

export async function acceptInvitation(token: string) {
  const session = await requireUser();
  const parsed = z.string().regex(/^[a-f0-9]{64}$/i).safeParse(token);
  if (!parsed.success) return { ok: false, message: "Tautan undangan tidak valid." };
  const hash = await tokenHash(parsed.data);
  let invitationRole: "owner" | "manager" | "finance" | "staff" | "tenant" = "tenant";
  try {
    await db.transaction(async (tx) => {
      const [invitation] = await tx.select().from(invitations).where(eq(invitations.tokenHash, hash)).for("update").limit(1);
      if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) throw new Error("INVITATION_INVALID");
      invitationRole = invitation.role;
      if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) throw new Error("INVITATION_EMAIL_MISMATCH");
      const [existing] = await tx.select({ id: members.id }).from(members).where(eq(members.userId, session.user.id)).limit(1);
      if (existing) throw new Error("ALREADY_MEMBER");
      let tenantId: string | undefined;
      if (invitation.role === "tenant") {
        const tenantProfiles = await tx.select({ id: tenants.id, userId: tenants.userId }).from(tenants).where(and(
          eq(tenants.organizationId, invitation.organizationId), sql`lower(${tenants.email}) = ${invitation.email.toLowerCase()}`,
        )).for("update").limit(2);
        if (tenantProfiles.length !== 1 || tenantProfiles[0].userId) throw new Error("TENANT_PROFILE_INVALID");
        tenantId = tenantProfiles[0].id;
        await tx.update(tenants).set({ userId: session.user.id, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
      }
      const memberId = id();
      await tx.insert(members).values({ id: memberId, organizationId: invitation.organizationId, userId: session.user.id, role: invitation.role });
      await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invitation.id));
      await audit(tx, invitation.organizationId, session.user.id, "invitation.accepted", "invitation", invitation.id, { memberId, role: invitation.role, tenantId });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVITATION_EMAIL_MISMATCH") return { ok: false, message: "Email akun ini tidak sesuai dengan email undangan." };
    if (error instanceof Error && error.message === "ALREADY_MEMBER") return { ok: false, message: "Akun ini sudah terhubung ke workspace lain." };
    if (error instanceof Error && error.message === "TENANT_PROFILE_INVALID") return { ok: false, message: "Profil penghuni untuk undangan ini tidak tersedia atau sudah terhubung." };
    return { ok: false, message: "Undangan tidak berlaku, sudah dipakai, atau telah kedaluwarsa." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/team");
  return { ok: true, message: "Undangan diterima.", role: invitationRole };
}

export async function revokeInvitation(form: FormData) {
  const ctx = await requireWorkspace(["owner"]);
  const invitationId = requiredText(80).safeParse(value(form, "invitationId"));
  if (!invitationId.success) go("/team", "error", "Undangan tidak valid.");
  const [invitation] = await db.select({ id: invitations.id, email: invitations.email }).from(invitations).where(and(
    eq(invitations.id, invitationId.data), eq(invitations.organizationId, ctx.organizationId), isNull(invitations.acceptedAt),
  )).limit(1);
  if (!invitation) go("/team", "error", "Undangan aktif tidak ditemukan.");
  await db.transaction(async (tx) => {
    await tx.delete(invitations).where(eq(invitations.id, invitation.id));
    await audit(tx, ctx.organizationId, ctx.userId, "invitation.revoked", "invitation", invitation.id, { email: invitation.email });
  });
  revalidatePath("/team");
  go("/team", "notice", "Undangan dibatalkan.");
}

export async function updateMemberRole(form: FormData) {
  const ctx = await requireWorkspace(["owner"]);
  const memberId = requiredText(80).safeParse(value(form, "memberId"));
  const role = z.enum(["manager", "finance", "staff"]).safeParse(value(form, "role"));
  if (!memberId.success || !role.success) go("/team", "error", "Data anggota tidak valid.");
  const [member] = await db.select({ id: members.id, userId: members.userId, role: members.role }).from(members)
    .where(and(eq(members.id, memberId.data), eq(members.organizationId, ctx.organizationId))).limit(1);
  if (!member || member.userId === ctx.userId || member.role === "owner") go("/team", "error", "Peran pemilik tidak dapat diubah dari halaman ini.");
  await db.transaction(async (tx) => {
    await tx.update(members).set({ role: role.data }).where(eq(members.id, member.id));
    await audit(tx, ctx.organizationId, ctx.userId, "member.role_changed", "member", member.id, { from: member.role, to: role.data });
  });
  revalidatePath("/team");
  go("/team", "notice", "Peran anggota diperbarui.");
}

export async function removeMember(form: FormData) {
  const ctx = await requireWorkspace(["owner"]);
  const memberId = requiredText(80).safeParse(value(form, "memberId"));
  if (!memberId.success) go("/team", "error", "Anggota tidak valid.");
  const [member] = await db.select({ id: members.id, userId: members.userId, role: members.role }).from(members)
    .where(and(eq(members.id, memberId.data), eq(members.organizationId, ctx.organizationId))).limit(1);
  if (!member || member.userId === ctx.userId || member.role === "owner") go("/team", "error", "Pemilik tidak dapat dihapus dari workspace ini.");
  await db.transaction(async (tx) => {
    await tx.delete(members).where(eq(members.id, member.id));
    await audit(tx, ctx.organizationId, ctx.userId, "member.removed", "member", member.id, { userId: member.userId });
  });
  revalidatePath("/team");
  go("/team", "notice", "Akses anggota dicabut.");
}

export async function createProperty(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const parsed = z.object({ name: requiredText(100), address: requiredText(300), timezone: z.string().max(80).default("Asia/Makassar") }).safeParse({
    name: value(form, "name"), address: value(form, "address"), timezone: value(form, "timezone") || "Asia/Makassar",
  });
  if (!parsed.success) go("/properties", "error", "Nama dan alamat properti wajib diisi.");
  const propertyId = id();
  try {
    await db.transaction(async (tx) => {
      const [organization] = await tx.select({ plan: organizations.plan }).from(organizations)
        .where(eq(organizations.id, ctx.organizationId)).for("update").limit(1);
      if (!organization) throw new Error("WORKSPACE_NOT_FOUND");
      const propertyLimit = PLAN_LIMITS[organization.plan].properties;
      if (propertyLimit !== null) {
        const [propertyCount] = await tx.select({ total: count() }).from(properties)
          .where(eq(properties.organizationId, ctx.organizationId));
        if (propertyCount.total >= propertyLimit) throw new Error("FREE_LIMIT_PROPERTIES");
      }
      await tx.insert(properties).values({ id: propertyId, organizationId: ctx.organizationId, ...parsed.data });
      await audit(tx, ctx.organizationId, ctx.userId, "property.created", "property", propertyId);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FREE_LIMIT_PROPERTIES") go("/properties", "error", "Paket Free dibatasi 1 properti. Ajukan upgrade ke Pro untuk menambah properti.");
    throw error;
  }
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  go("/properties", "notice", "Properti berhasil ditambahkan.");
}

export async function createRoom(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const parsed = z.object({
    propertyId: requiredText(80), code: requiredText(30), type: requiredText(50),
    floor: z.string().max(40), monthlyRent: positiveMoney, deposit: money,
  }).safeParse({
    propertyId: value(form, "propertyId"), code: value(form, "code"), type: value(form, "type") || "Standard",
    floor: value(form, "floor"), monthlyRent: value(form, "monthlyRent"), deposit: value(form, "deposit") || "0",
  });
  if (!parsed.success) go("/rooms", "error", "Lengkapi properti, kode kamar, dan harga sewa dengan benar.");
  const [property] = await db.select({ id: properties.id }).from(properties).where(and(eq(properties.id, parsed.data.propertyId), eq(properties.organizationId, ctx.organizationId))).limit(1);
  if (!property) go("/rooms", "error", "Properti tidak ditemukan di workspace ini.");
  const roomId = id();
  try {
    await db.transaction(async (tx) => {
      const [organization] = await tx.select({ plan: organizations.plan }).from(organizations)
        .where(eq(organizations.id, ctx.organizationId)).for("update").limit(1);
      if (!organization) throw new Error("WORKSPACE_NOT_FOUND");
      const roomLimit = PLAN_LIMITS[organization.plan].rooms;
      if (roomLimit !== null) {
        const [roomCount] = await tx.select({ total: count() }).from(rooms)
          .where(eq(rooms.organizationId, ctx.organizationId));
        if (roomCount.total >= roomLimit) throw new Error("FREE_LIMIT_ROOMS");
      }
      await tx.insert(rooms).values({
        id: roomId, organizationId: ctx.organizationId, propertyId: property.id, code: parsed.data.code,
        type: parsed.data.type, floor: parsed.data.floor || null, monthlyRent: parsed.data.monthlyRent,
        deposit: parsed.data.deposit, status: "available",
      });
      await audit(tx, ctx.organizationId, ctx.userId, "room.created", "room", roomId);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FREE_LIMIT_ROOMS") go("/rooms", "error", "Paket Free dibatasi 10 kamar. Ajukan upgrade ke Pro untuk menambah kamar.");
    go("/rooms", "error", "Kode kamar tersebut sudah dipakai pada properti ini.");
  }
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  go("/rooms", "notice", "Kamar berhasil ditambahkan.");
}

export async function updateRoomStatus(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const roomId = value(form, "roomId");
  const status = z.enum(["available", "maintenance", "inactive"]).safeParse(value(form, "status"));
  if (!status.success) go("/rooms", "error", "Status kamar tidak valid.");
  try {
    await db.transaction(async (tx) => {
      const [room] = await tx.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.organizationId, ctx.organizationId))).for("update").limit(1);
      if (!room) throw new Error("ROOM_MISSING");
      const activeLease = await tx.select({ id: leases.id }).from(leases).where(and(eq(leases.roomId, room.id), eq(leases.organizationId, ctx.organizationId), eq(leases.status, "active"))).limit(1);
      if (activeLease.length) throw new Error("ROOM_HAS_LEASE");
      await tx.update(rooms).set({ status: status.data, updatedAt: new Date() }).where(eq(rooms.id, room.id));
      await audit(tx, ctx.organizationId, ctx.userId, "room.status_changed", "room", room.id, { status: status.data });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ROOM_MISSING") go("/rooms", "error", "Kamar tidak ditemukan.");
    if (error instanceof Error && error.message === "ROOM_HAS_LEASE") go("/rooms", "error", "Status kamar diatur oleh kontrak aktif. Akhiri kontrak terlebih dahulu.");
    go("/rooms", "error", "Status kamar gagal diperbarui.");
  }
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  go("/rooms", "notice", "Status kamar diperbarui.");
}

export async function createTenant(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const parsed = z.object({
    fullName: requiredText(120), phone: requiredText(30), email: z.union([z.literal(""), z.email()]).default(""),
    emergencyContactName: z.string().max(120), emergencyContactPhone: z.string().max(30),
  }).safeParse({
    fullName: value(form, "fullName"), phone: value(form, "phone"), email: value(form, "email").toLowerCase(),
    emergencyContactName: value(form, "emergencyContactName"), emergencyContactPhone: value(form, "emergencyContactPhone"),
  });
  if (!parsed.success) go("/tenants", "error", "Nama dan nomor telepon wajib; email harus valid.");
  const tenantId = id();
  await db.transaction(async (tx) => {
    await tx.insert(tenants).values({
      id: tenantId, organizationId: ctx.organizationId, fullName: parsed.data.fullName, phone: parsed.data.phone,
      email: parsed.data.email || null, emergencyContactName: parsed.data.emergencyContactName || null,
      emergencyContactPhone: parsed.data.emergencyContactPhone || null,
    });
    await audit(tx, ctx.organizationId, ctx.userId, "tenant.created", "tenant", tenantId);
  });
  revalidatePath("/tenants");
  go("/tenants", "notice", "Penghuni berhasil ditambahkan.");
}

export async function createLease(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const parsed = z.object({
    tenantId: requiredText(80), roomId: requiredText(80), startsAt: z.iso.date(), endsAt: z.union([z.literal(""), z.iso.date()]),
    monthlyRent: positiveMoney, deposit: money, dueDay: z.coerce.number().int().min(1).max(31),
  }).safeParse({
    tenantId: value(form, "tenantId"), roomId: value(form, "roomId"), startsAt: value(form, "startsAt"),
    endsAt: value(form, "endsAt"), monthlyRent: value(form, "monthlyRent"), deposit: value(form, "deposit") || "0",
    dueDay: value(form, "dueDay") || "1",
  });
  if (!parsed.success) go("/leases", "error", "Lengkapi data kontrak dengan benar.");
  if (parsed.data.endsAt && parsed.data.endsAt < parsed.data.startsAt) go("/leases", "error", "Tanggal akhir tidak boleh sebelum tanggal mulai.");
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(and(eq(tenants.id, parsed.data.tenantId), eq(tenants.organizationId, ctx.organizationId))).limit(1);
  if (!tenant) go("/leases", "error", "Penghuni tidak ditemukan.");
  const leaseId = id();
  try {
    await db.transaction(async (tx) => {
      const [room] = await tx.select({ id: rooms.id, propertyId: rooms.propertyId, status: rooms.status }).from(rooms)
        .where(and(eq(rooms.id, parsed.data.roomId), eq(rooms.organizationId, ctx.organizationId))).for("update").limit(1);
      if (!room || ["maintenance", "inactive"].includes(room.status)) throw new Error("ROOM_UNAVAILABLE");
      const overlap = await tx.select({ id: leases.id }).from(leases).where(and(
        eq(leases.roomId, room.id), eq(leases.organizationId, ctx.organizationId), eq(leases.status, "active"),
        lte(leases.startsAt, parsed.data.endsAt || "9999-12-31"),
        or(isNull(leases.endsAt), gte(leases.endsAt, parsed.data.startsAt)),
      )).limit(1);
      if (overlap.length) throw new Error("LEASE_OVERLAP");
      const today = todayISO();
      const activeToday = parsed.data.startsAt <= today && (!parsed.data.endsAt || parsed.data.endsAt >= today);
      await tx.insert(leases).values({
        id: leaseId, organizationId: ctx.organizationId, tenantId: tenant.id, roomId: room.id,
        startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt || null,
        monthlyRent: parsed.data.monthlyRent, deposit: parsed.data.deposit, dueDay: parsed.data.dueDay,
        status: "active",
      });
      await tx.update(rooms).set({ status: activeToday ? "occupied" : "reserved", updatedAt: new Date() }).where(eq(rooms.id, room.id));
      await audit(tx, ctx.organizationId, ctx.userId, "lease.created", "lease", leaseId, { roomId: room.id, tenantId: tenant.id });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LEASE_OVERLAP") go("/leases", "error", "Tanggal kontrak bertabrakan dengan kontrak aktif lain.");
    if (error instanceof Error && error.message === "ROOM_UNAVAILABLE") go("/leases", "error", "Kamar tidak tersedia untuk dikontrakkan.");
    go("/leases", "error", "Kontrak tidak dapat disimpan. Periksa kamar dan tanggal.");
  }
  revalidatePath("/leases");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  go("/leases", "notice", "Kontrak berhasil dibuat.");
}

export async function endLease(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const leaseId = requiredText(80).safeParse(value(form, "leaseId"));
  if (!leaseId.success) go("/leases", "error", "Kontrak tidak valid.");
  const today = todayISO();
  try {
    await db.transaction(async (tx) => {
      const [lease] = await tx.select({ id: leases.id, roomId: leases.roomId, startsAt: leases.startsAt, endsAt: leases.endsAt, status: leases.status })
        .from(leases).where(and(eq(leases.id, leaseId.data), eq(leases.organizationId, ctx.organizationId))).for("update").limit(1);
      if (!lease || lease.status !== "active") throw new Error("LEASE_NOT_ACTIVE");
      const [room] = await tx.select({ id: rooms.id, status: rooms.status }).from(rooms)
        .where(and(eq(rooms.id, lease.roomId), eq(rooms.organizationId, ctx.organizationId))).for("update").limit(1);
      if (!room) throw new Error("ROOM_MISSING");

      const cancelledBeforeStart = lease.startsAt > today;
      const finalStatus = cancelledBeforeStart ? "cancelled" : "ended";
      const finalEndDate = cancelledBeforeStart ? lease.endsAt : lease.endsAt && lease.endsAt < today ? lease.endsAt : today;
      await tx.update(leases).set({ status: finalStatus, endsAt: finalEndDate, updatedAt: new Date() }).where(eq(leases.id, lease.id));

      const remainingLeases = await tx.select({ startsAt: leases.startsAt, endsAt: leases.endsAt }).from(leases).where(and(
        eq(leases.roomId, room.id), eq(leases.organizationId, ctx.organizationId), eq(leases.status, "active"),
        or(isNull(leases.endsAt), gte(leases.endsAt, today)),
      ));
      const occupied = remainingLeases.some((item) => item.startsAt <= today);
      const reserved = remainingLeases.some((item) => item.startsAt > today);
      const nextRoomStatus = occupied ? "occupied" : reserved ? "reserved" : room.status === "maintenance" || room.status === "inactive" ? room.status : "available";
      if (nextRoomStatus !== room.status) {
        await tx.update(rooms).set({ status: nextRoomStatus, updatedAt: new Date() }).where(eq(rooms.id, room.id));
        await audit(tx, ctx.organizationId, ctx.userId, "room.status_changed", "room", room.id, { status: nextRoomStatus });
      }
      await audit(tx, ctx.organizationId, ctx.userId, cancelledBeforeStart ? "lease.cancelled" : "lease.ended", "lease", lease.id, { endsAt: finalEndDate });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LEASE_NOT_ACTIVE") go("/leases", "error", "Kontrak ini tidak lagi aktif.");
    if (error instanceof Error && error.message === "ROOM_MISSING") go("/leases", "error", "Kamar kontrak tidak ditemukan.");
    go("/leases", "error", "Kontrak gagal diakhiri.");
  }
  revalidatePath("/leases");
  revalidatePath("/rooms");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  go("/leases", "notice", "Kontrak diakhiri; status kamar diperbarui.");
}

export async function generateMonthlyInvoices(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const month = value(form, "month");
  const range = monthRange(month);
  if (!range) go("/billing", "error", "Pilih periode tagihan yang valid.");
  let created = 0;
  await db.transaction(async (tx) => {
    const activeLeases = await tx.select({ id: leases.id, roomId: leases.roomId, rent: leases.monthlyRent, dueDay: leases.dueDay })
      .from(leases).where(and(
        eq(leases.organizationId, ctx.organizationId), eq(leases.status, "active"),
        lte(leases.startsAt, range.end), or(isNull(leases.endsAt), gte(leases.endsAt, range.start)),
      ));
    for (const lease of activeLeases) {
      const dueDay = Math.min(lease.dueDay, new Date(Date.UTC(range.year, range.month, 0)).getUTCDate());
      const dueAt = `${range.year}-${String(range.month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
      const utilityItems = await tx.select({ type: utilityReadings.meterType, amount: utilityReadings.amount }).from(utilityReadings).where(and(
        eq(utilityReadings.organizationId, ctx.organizationId), eq(utilityReadings.roomId, lease.roomId), eq(utilityReadings.periodStart, range.start),
      ));
      const utilityTotal = utilityItems.reduce((sum, item) => sum + BigInt(item.amount), BigInt(0));
      const invoiceAmount = (BigInt(lease.rent) + utilityTotal).toString();
      const invoiceId = id();
      const inserted = await tx.insert(invoices).values({
        id: invoiceId, organizationId: ctx.organizationId, leaseId: lease.id,
        periodStart: range.start, dueAt, amount: invoiceAmount, paidAmount: "0", status: "unpaid",
      }).onConflictDoNothing({ target: [invoices.leaseId, invoices.periodStart] }).returning({ id: invoices.id });
      if (inserted.length) {
        created += 1;
        await tx.insert(invoiceItems).values({ id: id(), invoiceId, label: "Sewa kamar", quantity: "1", unitPrice: lease.rent, amount: lease.rent });
        if (utilityItems.length) {
          await tx.insert(invoiceItems).values(utilityItems.map((item) => ({
            id: id(), invoiceId, label: item.type === "electricity" ? "Pemakaian listrik" : item.type === "water" ? "Pemakaian air" : `Utilitas: ${item.type}`,
            quantity: "1", unitPrice: item.amount, amount: item.amount,
          })));
        }
      }
    }
    await audit(tx, ctx.organizationId, ctx.userId, "invoices.generated", "invoice_period", range.start, { created, period: month });
  });
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  go("/billing", "notice", `${created} tagihan baru dibuat; tagihan yang sudah ada tidak digandakan.`);
}

export async function createPayment(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const parsed = z.object({ invoiceId: requiredText(80), amount: money, method: requiredText(40), reference: z.string().max(120) }).safeParse({
    invoiceId: value(form, "invoiceId"), amount: value(form, "amount"), method: value(form, "method") || "transfer", reference: value(form, "reference"),
  });
  if (!parsed.success) go("/billing", "error", "Pilih tagihan dan isi nominal pembayaran dengan benar.");
  try {
    await db.transaction(async (tx) => {
      const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, parsed.data.invoiceId), eq(invoices.organizationId, ctx.organizationId))).for("update").limit(1);
      if (!invoice || invoice.status === "cancelled") throw new Error("INVOICE_INVALID");
      const amount = BigInt(parsed.data.amount);
      const balance = BigInt(invoice.amount) - BigInt(invoice.paidAmount);
      if (amount <= BigInt(0) || amount > balance) throw new Error("AMOUNT_INVALID");
      const paidAmount = BigInt(invoice.paidAmount) + amount;
      const status = paidAmount === BigInt(invoice.amount) ? "paid" : "partial";
      const paymentId = id();
      await tx.insert(payments).values({
        id: paymentId, organizationId: ctx.organizationId, invoiceId: invoice.id,
        amount: parsed.data.amount, method: parsed.data.method, reference: parsed.data.reference || null,
        status: "verified", verifiedBy: ctx.userId,
      });
      await tx.update(invoices).set({ paidAmount: paidAmount.toString(), status, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
      await audit(tx, ctx.organizationId, ctx.userId, "payment.verified", "payment", paymentId, { invoiceId: invoice.id, amount: parsed.data.amount });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "AMOUNT_INVALID") go("/billing", "error", "Nominal pembayaran melebihi sisa tagihan.");
    go("/billing", "error", "Pembayaran gagal dicatat. Periksa kembali tagihannya.");
  }
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  go("/billing", "notice", "Pembayaran diverifikasi dan dicatat.");
}

export async function createExpense(form: FormData) {
  const ctx = await requireWorkspace(["owner", "finance"]);
  const parsed = z.object({
    propertyId: requiredText(80), category: requiredText(80), amount: positiveMoney, occurredAt: z.iso.date(), vendor: z.string().max(120), note: z.string().max(500),
  }).safeParse({
    propertyId: value(form, "propertyId"), category: value(form, "category"), amount: value(form, "amount"), occurredAt: value(form, "occurredAt"),
    vendor: value(form, "vendor"), note: value(form, "note"),
  });
  if (!parsed.success) go("/expenses", "error", "Lengkapi kategori, properti, nominal, dan tanggal.");
  const [property] = await db.select({ id: properties.id }).from(properties).where(and(eq(properties.id, parsed.data.propertyId), eq(properties.organizationId, ctx.organizationId))).limit(1);
  if (!property) go("/expenses", "error", "Properti tidak ditemukan.");
  const expenseId = id();
  await db.transaction(async (tx) => {
    await tx.insert(expenses).values({ id: expenseId, organizationId: ctx.organizationId, propertyId: property.id, category: parsed.data.category, amount: parsed.data.amount, occurredAt: parsed.data.occurredAt, vendor: parsed.data.vendor || null, note: parsed.data.note || null, createdBy: ctx.userId });
    await audit(tx, ctx.organizationId, ctx.userId, "expense.created", "expense", expenseId);
  });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  go("/expenses", "notice", "Biaya berhasil dicatat.");
}

function meterMilli(raw: string) {
  const match = /^(\d{1,11})(?:\.(\d{1,3}))?$/.exec(raw);
  if (!match) return null;
  return BigInt(match[1]) * BigInt(1000) + BigInt((match[2] ?? "").padEnd(3, "0") || "0");
}

export async function createUtilityReading(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const roomId = value(form, "roomId"), periodInput = value(form, "periodStart"), meterType = value(form, "meterType");
  const startRaw = value(form, "startValue"), endRaw = value(form, "endValue"), rateRaw = value(form, "rate");
  const start = meterMilli(startRaw), end = meterMilli(endRaw);
  const periodRange = monthRange(periodInput);
  const valid = requiredText(80).safeParse(roomId).success && periodRange !== null && requiredText(30).safeParse(meterType).success && start !== null && end !== null && end >= start && money.safeParse(rateRaw).success;
  if (!valid || start === null || end === null || !periodRange) go("/utilities", "error", "Periksa kamar, periode, angka meter, dan tarif.");
  const period = periodRange.start;
  const [room] = await db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.organizationId, ctx.organizationId))).limit(1);
  if (!room) go("/utilities", "error", "Kamar tidak ditemukan.");
  const amount = ((end - start) * BigInt(rateRaw) + BigInt(999)) / BigInt(1000);
  const readingId = id();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(utilityReadings).values({
        id: readingId, organizationId: ctx.organizationId, roomId: room.id, periodStart: period, meterType,
        startValue: startRaw, endValue: endRaw, rate: rateRaw, amount: amount.toString(), recordedBy: ctx.userId,
      });
      await audit(tx, ctx.organizationId, ctx.userId, "utility_reading.created", "utility_reading", readingId, { amount: amount.toString() });
    });
  } catch {
    go("/utilities", "error", "Meter kamar ini sudah dicatat untuk periode dan jenis tersebut.");
  }
  revalidatePath("/utilities");
  go("/utilities", "notice", `Meter dicatat. Total pemakaian: ${amount.toString()} rupiah.`);
}

export async function createMaintenanceTicket(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const parsed = z.object({
    roomId: requiredText(80), tenantId: z.string().max(80), category: requiredText(60), description: requiredText(1000),
    priority: z.enum(["low", "normal", "high", "urgent"]),
  }).safeParse({
    roomId: value(form, "roomId"), tenantId: value(form, "tenantId"), category: value(form, "category"),
    description: value(form, "description"), priority: value(form, "priority") || "normal",
  });
  if (!parsed.success) go("/maintenance", "error", "Lengkapi kamar, kategori, deskripsi, dan prioritas.");
  const [room] = await db.select({ id: rooms.id }).from(rooms).where(and(eq(rooms.id, parsed.data.roomId), eq(rooms.organizationId, ctx.organizationId))).limit(1);
  if (!room) go("/maintenance", "error", "Kamar tidak ditemukan.");
  if (parsed.data.tenantId) {
    const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(and(eq(tenants.id, parsed.data.tenantId), eq(tenants.organizationId, ctx.organizationId))).limit(1);
    if (!tenant) go("/maintenance", "error", "Penghuni tidak ditemukan.");
  }
  const ticketId = id();
  await db.transaction(async (tx) => {
    await tx.insert(maintenanceTickets).values({
      id: ticketId, organizationId: ctx.organizationId, roomId: room.id, tenantId: parsed.data.tenantId || null,
      category: parsed.data.category, description: parsed.data.description, priority: parsed.data.priority, status: "new",
    });
    await audit(tx, ctx.organizationId, ctx.userId, "maintenance.created", "maintenance_ticket", ticketId);
  });
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  go("/maintenance", "notice", "Keluhan berhasil dicatat.");
}

export async function updateMaintenanceStatus(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager", "staff"]);
  const ticketId = value(form, "ticketId");
  const status = z.enum(["new", "in_progress", "waiting_tenant", "completed", "rejected"]).safeParse(value(form, "status"));
  if (!status.success) go("/maintenance", "error", "Status tiket tidak valid.");
  const [ticket] = await db.select({ id: maintenanceTickets.id }).from(maintenanceTickets).where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.organizationId, ctx.organizationId))).limit(1);
  if (!ticket) go("/maintenance", "error", "Tiket tidak ditemukan.");
  if (ctx.role === "staff" && (await db.select({ id: maintenanceTickets.id }).from(maintenanceTickets).where(and(eq(maintenanceTickets.id, ticket.id), eq(maintenanceTickets.assignedMemberId, ctx.memberId))).limit(1)).length === 0) go("/maintenance", "error", "Tiket ini tidak ditugaskan kepada Anda.");
  await db.transaction(async (tx) => {
    await tx.update(maintenanceTickets).set({ status: status.data, updatedAt: new Date() }).where(eq(maintenanceTickets.id, ticket.id));
    await audit(tx, ctx.organizationId, ctx.userId, "maintenance.status_changed", "maintenance_ticket", ticket.id, { status: status.data });
  });
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  go("/maintenance", "notice", "Status keluhan diperbarui.");
}

export async function addMaintenanceComment(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager", "staff"]);
  const ticketId = value(form, "ticketId"), body = requiredText(1000).safeParse(value(form, "body"));
  if (!body.success) go("/maintenance", "error", "Komentar wajib diisi dan maksimal 1.000 karakter.");
  const [ticket] = await db.select({ id: maintenanceTickets.id }).from(maintenanceTickets).where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.organizationId, ctx.organizationId))).limit(1);
  if (!ticket) go("/maintenance", "error", "Tiket tidak ditemukan.");
  if (ctx.role === "staff" && (await db.select({ id: maintenanceTickets.id }).from(maintenanceTickets).where(and(eq(maintenanceTickets.id, ticket.id), eq(maintenanceTickets.assignedMemberId, ctx.memberId))).limit(1)).length === 0) go("/maintenance", "error", "Tiket ini tidak ditugaskan kepada Anda.");
  const commentId = id();
  await db.transaction(async (tx) => {
    await tx.insert(maintenanceComments).values({ id: commentId, ticketId: ticket.id, authorUserId: ctx.userId, body: body.data });
    await audit(tx, ctx.organizationId, ctx.userId, "maintenance.comment_added", "maintenance_ticket", ticket.id);
  });
  revalidatePath("/maintenance");
  go("/maintenance", "notice", "Komentar ditambahkan.");
}

export async function assignMaintenanceTicket(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const ticketId = value(form, "ticketId"), memberId = value(form, "memberId");
  const [ticket] = await db.select({ id: maintenanceTickets.id }).from(maintenanceTickets).where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.organizationId, ctx.organizationId))).limit(1);
  if (!ticket) go("/maintenance", "error", "Tiket tidak ditemukan.");
  if (memberId) {
    const [member] = await db.select({ id: members.id }).from(members).where(and(eq(members.id, memberId), eq(members.organizationId, ctx.organizationId))).limit(1);
    if (!member) go("/maintenance", "error", "Anggota tim tidak ditemukan.");
  }
  await db.transaction(async (tx) => {
    await tx.update(maintenanceTickets).set({ assignedMemberId: memberId || null, updatedAt: new Date() }).where(eq(maintenanceTickets.id, ticket.id));
    await audit(tx, ctx.organizationId, ctx.userId, "maintenance.assigned", "maintenance_ticket", ticket.id, { memberId: memberId || null });
  });
  revalidatePath("/maintenance");
  go("/maintenance", "notice", "Penugasan diperbarui.");
}



export async function createPlanRequest() {
  const ctx = await requireWorkspace(["owner"]);
  const requestId = id();
  try {
    await db.transaction(async (tx) => {
      const [organization] = await tx.select({ plan: organizations.plan }).from(organizations)
        .where(eq(organizations.id, ctx.organizationId)).for("update").limit(1);
      if (!organization) throw new Error("WORKSPACE_NOT_FOUND");
      if (organization.plan === "pro") throw new Error("ALREADY_PRO");
      const [pendingRequest] = await tx.select({ id: planRequests.id }).from(planRequests).where(and(
        eq(planRequests.organizationId, ctx.organizationId), eq(planRequests.status, "pending"),
      )).limit(1);
      if (pendingRequest) throw new Error("REQUEST_PENDING");
      await tx.insert(planRequests).values({
        id: requestId, organizationId: ctx.organizationId, requestedBy: ctx.userId, status: "pending",
      });
      await audit(tx, ctx.organizationId, ctx.userId, "plan.upgrade_requested", "plan_request", requestId, { from: "free", to: "pro" });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_PRO") go("/plan", "notice", "Workspace ini sudah menggunakan Paket Pro.");
    if (error instanceof Error && error.message === "REQUEST_PENDING") go("/plan", "error", "Permintaan upgrade masih menunggu tinjauan admin.");
    throw error;
  }
  revalidatePath("/plan");
  revalidatePath("/admin/plans");
  go("/plan", "notice", "Permintaan upgrade Pro berhasil dikirim untuk ditinjau admin.");
}

export async function reviewPlanRequest(form: FormData) {
  const admin = await requirePlatformAdmin();
  const parsed = z.object({
    requestId: requiredText(80),
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(500),
  }).safeParse({
    requestId: value(form, "requestId"),
    decision: value(form, "decision"),
    note: value(form, "note"),
  });
  if (!parsed.success) go("/admin/plans", "error", "Data tinjauan tidak valid.");

  try {
    await db.transaction(async (tx) => {
      const [request] = await tx.select().from(planRequests).where(eq(planRequests.id, parsed.data.requestId)).for("update").limit(1);
      if (!request || request.status !== "pending") throw new Error("REQUEST_NOT_PENDING");
      const [organization] = await tx.select({ id: organizations.id }).from(organizations)
        .where(eq(organizations.id, request.organizationId)).for("update").limit(1);
      if (!organization) throw new Error("WORKSPACE_NOT_FOUND");

      const reviewedAt = new Date();
      await tx.update(planRequests).set({
        status: parsed.data.decision, reviewedBy: admin.userId, reviewedAt,
        reviewNote: parsed.data.note || null, updatedAt: reviewedAt,
      }).where(eq(planRequests.id, request.id));
      if (parsed.data.decision === "approved") {
        await tx.update(organizations).set({ plan: "pro", updatedAt: reviewedAt })
          .where(eq(organizations.id, request.organizationId));
      }
      await audit(tx, request.organizationId, admin.userId, "plan.upgrade_reviewed", "plan_request", request.id, {
        decision: parsed.data.decision, note: parsed.data.note || null,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") go("/admin/plans", "error", "Permintaan ini sudah ditinjau atau tidak ditemukan.");
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") go("/admin/plans", "error", "Workspace tidak ditemukan.");
    throw error;
  }

  revalidatePath("/admin/plans");
  revalidatePath("/plan");
  revalidatePath("/dashboard");
  go("/admin/plans", "notice", parsed.data.decision === "approved" ? "Paket Pro berhasil diaktifkan." : "Permintaan upgrade ditolak.");
}


export async function createTenantPortalInvite(
  _previousState: { error?: string; inviteLink?: string },
  form: FormData,
): Promise<{ error?: string; inviteLink?: string }> {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const parsed = z.object({ tenantId: requiredText(80) }).safeParse({ tenantId: value(form, "tenantId") });
  if (!parsed.success) return { error: "Profil penghuni tidak valid." };

  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const invitationId = id();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    await db.transaction(async (tx) => {
      const [organization] = await tx.select({ plan: organizations.plan }).from(organizations)
        .where(eq(organizations.id, ctx.organizationId)).for("update").limit(1);
      if (!organization) throw new Error("WORKSPACE_NOT_FOUND");

      const [tenant] = await tx.select().from(tenants).where(and(
        eq(tenants.id, parsed.data.tenantId), eq(tenants.organizationId, ctx.organizationId),
      )).for("update").limit(1);
      if (!tenant) throw new Error("TENANT_NOT_FOUND");
      if (tenant.userId) throw new Error("TENANT_PORTAL_ACTIVE");
      if (!tenant.email) throw new Error("TENANT_EMAIL_REQUIRED");
      const email = tenant.email.trim().toLowerCase();

      const [existingMember] = await tx.select({ id: members.id }).from(members).innerJoin(authUsers, eq(members.userId, authUsers.id))
        .where(sql`lower(${authUsers.email}) = ${email}`).limit(1);
      if (existingMember) throw new Error("ACCOUNT_ALREADY_LINKED");
      const [activeInvitation] = await tx.select({ id: invitations.id }).from(invitations).where(and(
        eq(invitations.organizationId, ctx.organizationId), sql`lower(${invitations.email}) = ${email}`,
        isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()),
      )).limit(1);
      if (activeInvitation) throw new Error("INVITATION_ALREADY_PENDING");

      const memberLimit = PLAN_LIMITS[organization.plan].members;
      if (memberLimit !== null) {
        const [memberCount] = await tx.select({ total: count() }).from(members)
          .where(eq(members.organizationId, ctx.organizationId));
        const [invitationCount] = await tx.select({ total: count() }).from(invitations).where(and(
          eq(invitations.organizationId, ctx.organizationId), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()),
        ));
        if (memberCount.total + invitationCount.total >= memberLimit) throw new Error("FREE_LIMIT_MEMBERS");
      }

      await tx.insert(invitations).values({
        id: invitationId, organizationId: ctx.organizationId, email, role: "tenant",
        tokenHash: await tokenHash(token), expiresAt, createdBy: ctx.userId,
      });
      await audit(tx, ctx.organizationId, ctx.userId, "tenant.portal_invited", "tenant", tenant.id, { email, expiresAt });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") return { error: "Profil penghuni tidak ditemukan." };
    if (error instanceof Error && error.message === "TENANT_PORTAL_ACTIVE") return { error: "Akun portal penghuni ini sudah aktif." };
    if (error instanceof Error && error.message === "TENANT_EMAIL_REQUIRED") return { error: "Tambahkan email penghuni sebelum mengirim undangan portal." };
    if (error instanceof Error && error.message === "ACCOUNT_ALREADY_LINKED") return { error: "Email ini sudah terhubung ke akun workspace lain." };
    if (error instanceof Error && error.message === "INVITATION_ALREADY_PENDING") return { error: "Undangan aktif untuk email ini sudah tersedia." };
    if (error instanceof Error && error.message === "FREE_LIMIT_MEMBERS") return { error: "Kuota Paket Free sudah penuh. Upgrade ke Pro untuk menambah akun." };
    return { error: "Undangan portal gagal dibuat. Coba lagi." };
  }

  revalidatePath("/team");
  revalidatePath("/tenants");
  const deploymentBaseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? deploymentBaseUrl ?? "http://localhost:3000";
  const baseUrl = configuredBaseUrl.endsWith("/") ? configuredBaseUrl.slice(0, -1) : configuredBaseUrl;
  return { inviteLink: baseUrl + "/invite?token=" + encodeURIComponent(token) };
}

export async function createTenantTicket(form: FormData) {
  const ctx = await requireTenantWorkspace();
  const parsed = z.object({
    category: requiredText(60),
    description: requiredText(1000),
  }).safeParse({ category: value(form, "category"), description: value(form, "description") });
  if (!parsed.success) go("/tenant", "error", "Isi kategori dan deskripsi keluhan.");

  const today = todayISO();
  const [lease] = await db.select({ id: leases.id, roomId: leases.roomId }).from(leases).where(and(
    eq(leases.organizationId, ctx.organizationId), eq(leases.tenantId, ctx.tenant.id), eq(leases.status, "active"),
    lte(leases.startsAt, today), or(isNull(leases.endsAt), gte(leases.endsAt, today)),
  )).orderBy(leases.startsAt).limit(1);
  if (!lease) go("/tenant", "error", "Tiket hanya dapat dibuat untuk kontrak yang sedang aktif.");

  const ticketId = id();
  await db.transaction(async (tx) => {
    await tx.insert(maintenanceTickets).values({
      id: ticketId, organizationId: ctx.organizationId, tenantId: ctx.tenant.id, roomId: lease.roomId,
      category: parsed.data.category, description: parsed.data.description, priority: "normal", status: "new",
    });
    await audit(tx, ctx.organizationId, ctx.userId, "maintenance.created_by_tenant", "maintenance_ticket", ticketId);
  });
  revalidatePath("/tenant");
  revalidatePath("/maintenance");
  go("/tenant", "notice", "Keluhan berhasil dikirim.");
}

export async function getAuthenticatedLandingPath() {
  const session = await getServerSession();
  if (!session) return "/login";
  const [membership] = await db.select({ role: members.role }).from(members)
    .where(eq(members.userId, session.user.id)).limit(1);
  if (!membership) return "/setup";
  return membership.role === "tenant" ? "/tenant" : "/dashboard";
}
export async function submitTenantPayment(form: FormData) {
  const ctx = await requireTenantWorkspace();
  const parsed = z.object({
    invoiceId: z.string().uuid(), amount: positiveMoney, reference: z.string().trim().max(120),
  }).safeParse({
    invoiceId: value(form, "invoiceId"), amount: value(form, "amount"), reference: value(form, "reference"),
  });
  if (!parsed.success) go("/tenant", "error", "Isi nominal dan referensi pembayaran dengan benar.");

  try {
    await db.transaction(async (tx) => {
      const [invoice] = await tx.select().from(invoices).where(and(
        eq(invoices.id, parsed.data.invoiceId), eq(invoices.organizationId, ctx.organizationId),
      )).for("update").limit(1);
      if (!invoice || invoice.status === "cancelled") throw new Error("INVOICE_INVALID");

      const [lease] = await tx.select({ tenantId: leases.tenantId }).from(leases).where(and(
        eq(leases.id, invoice.leaseId), eq(leases.organizationId, ctx.organizationId),
      )).limit(1);
      if (!lease || lease.tenantId !== ctx.tenant.id) throw new Error("INVOICE_NOT_OWNED");

      const amount = BigInt(parsed.data.amount);
      const remaining = BigInt(invoice.amount) - BigInt(invoice.paidAmount);
      const [pending] = await tx.select({ total: sum(payments.amount) }).from(payments).where(and(
        eq(payments.invoiceId, invoice.id), eq(payments.organizationId, ctx.organizationId), eq(payments.status, "pending"),
      ));
      const available = remaining - BigInt(pending.total ?? "0");
      if (amount <= BigInt(0) || amount > available) throw new Error("AMOUNT_EXCEEDS_BALANCE");

      const paymentId = id();
      await tx.insert(payments).values({
        id: paymentId, organizationId: ctx.organizationId, invoiceId: invoice.id, amount: parsed.data.amount,
        method: "transfer", reference: parsed.data.reference || null, status: "pending",
        note: "Konfirmasi pembayaran dikirim dari portal penghuni.",
      });
      await audit(tx, ctx.organizationId, ctx.userId, "payment.declared_by_tenant", "payment", paymentId, {
        invoiceId: invoice.id, amount: parsed.data.amount, reference: parsed.data.reference || null,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVOICE_INVALID") go("/tenant", "error", "Tagihan tidak tersedia.");
    if (error instanceof Error && error.message === "INVOICE_NOT_OWNED") go("/tenant", "error", "Tagihan tidak ditemukan di akun ini.");
    if (error instanceof Error && error.message === "AMOUNT_EXCEEDS_BALANCE") go("/tenant", "error", "Nominal melebihi sisa tagihan setelah pembayaran yang menunggu.");
    go("/tenant", "error", "Konfirmasi pembayaran gagal dikirim. Coba lagi.");
  }

  revalidatePath("/tenant");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  go("/tenant", "notice", "Konfirmasi pembayaran terkirim dan menunggu verifikasi pengelola.");
}
export async function reviewTenantPayment(form: FormData) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const parsed = z.object({
    paymentId: requiredText(80), decision: z.enum(["verify", "reject"]), note: z.string().trim().max(500),
  }).safeParse({
    paymentId: value(form, "paymentId"), decision: value(form, "decision"), note: value(form, "note"),
  });
  if (!parsed.success) go("/billing", "error", "Data tinjauan pembayaran tidak valid.");

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(and(
        eq(payments.id, parsed.data.paymentId), eq(payments.organizationId, ctx.organizationId),
      )).for("update").limit(1);
      if (!payment || payment.status !== "pending") throw new Error("PAYMENT_NOT_PENDING");
      const [invoice] = await tx.select().from(invoices).where(and(
        eq(invoices.id, payment.invoiceId), eq(invoices.organizationId, ctx.organizationId),
      )).for("update").limit(1);
      if (!invoice || invoice.status === "cancelled") throw new Error("INVOICE_INVALID");

      if (parsed.data.decision === "verify") {
        const remaining = BigInt(invoice.amount) - BigInt(invoice.paidAmount);
        const amount = BigInt(payment.amount);
        if (amount <= BigInt(0) || amount > remaining) throw new Error("PAYMENT_AMOUNT_EXCEEDS_BALANCE");
        const paidAmount = BigInt(invoice.paidAmount) + amount;
        await tx.update(payments).set({ status: "verified", verifiedBy: ctx.userId })
          .where(eq(payments.id, payment.id));
        await tx.update(invoices).set({
          paidAmount: paidAmount.toString(),
          status: paidAmount === BigInt(invoice.amount) ? "paid" : "partial",
          updatedAt: new Date(),
        }).where(eq(invoices.id, invoice.id));
        await audit(tx, ctx.organizationId, ctx.userId, "payment.tenant_declaration_verified", "payment", payment.id, {
          invoiceId: invoice.id, amount: payment.amount,
        });
      } else {
        const reason = parsed.data.note || "Konfirmasi pembayaran ditolak. Hubungi pengelola untuk detail.";
        await tx.update(payments).set({ status: "rejected", note: reason })
          .where(eq(payments.id, payment.id));
        await audit(tx, ctx.organizationId, ctx.userId, "payment.tenant_declaration_rejected", "payment", payment.id, {
          invoiceId: invoice.id, amount: payment.amount, reason,
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_NOT_PENDING") go("/billing", "error", "Pembayaran sudah ditinjau atau tidak lagi tersedia.");
    if (error instanceof Error && error.message === "INVOICE_INVALID") go("/billing", "error", "Tagihan pembayaran tidak lagi tersedia.");
    if (error instanceof Error && error.message === "PAYMENT_AMOUNT_EXCEEDS_BALANCE") go("/billing", "error", "Nominal pembayaran melebihi sisa tagihan. Periksa pembayaran lain terlebih dahulu.");
    go("/billing", "error", "Tinjauan pembayaran gagal. Coba lagi.");
  }
  revalidatePath("/billing");
  revalidatePath("/tenant");
  revalidatePath("/dashboard");
  go("/billing", "notice", parsed.data.decision === "verify" ? "Pembayaran diverifikasi dan saldo tagihan diperbarui." : "Konfirmasi pembayaran ditolak.");
}

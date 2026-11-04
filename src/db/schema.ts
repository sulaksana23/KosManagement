import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// Better Auth tables: keep property names aligned with the adapter's expected schema.
export const authUsers = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const authSessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_id_idx").on(table.userId)]);

export const authAccounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("account_user_id_idx").on(table.userId)]);

export const authVerifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const memberRole = pgEnum("member_role", ["owner", "manager", "finance", "staff", "tenant"]);
export const roomStatus = pgEnum("room_status", ["available", "reserved", "occupied", "maintenance", "inactive"]);
export const leaseStatus = pgEnum("lease_status", ["draft", "active", "ended", "cancelled"]);
export const invoiceStatus = pgEnum("invoice_status", ["unpaid", "partial", "paid", "overdue", "cancelled"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "verified", "rejected"]);
export const maintenanceStatus = pgEnum("maintenance_status", ["new", "in_progress", "waiting_tenant", "completed", "rejected"]);
export const maintenancePriority = pgEnum("maintenance_priority", ["low", "normal", "high", "urgent"]);

export const organizations = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Makassar"),
  currency: text("currency").notNull().default("IDR"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const members = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  role: memberRole("role").notNull().default("owner"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("member_organization_user_unique").on(table.organizationId, table.userId),
  uniqueIndex("member_user_unique").on(table.userId),
]);

export const properties = pgTable("property", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  timezone: text("timezone").notNull().default("Asia/Makassar"),
  rules: text("rules"),
  facilities: text("facilities").array().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("property_organization_idx").on(table.organizationId)]);

export const rooms = pgTable("room", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  propertyId: text("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  floor: text("floor"),
  type: text("type").notNull().default("Standard"),
  monthlyRent: numeric("monthly_rent", { precision: 14, scale: 0 }).notNull(),
  deposit: numeric("deposit", { precision: 14, scale: 0 }).notNull().default("0"),
  status: roomStatus("status").notNull().default("available"),
  facilities: text("facilities").array().notNull().default([]),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("room_property_code_unique").on(table.propertyId, table.code),
  index("room_organization_status_idx").on(table.organizationId, table.status),
  index("room_property_idx").on(table.propertyId),
]);

export const tenants = pgTable("tenant", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => authUsers.id, { onDelete: "set null" }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("tenant_organization_name_idx").on(table.organizationId, table.fullName),
  index("tenant_user_idx").on(table.userId),
]);

export const leases = pgTable("lease", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "restrict" }),
  startsAt: date("starts_at").notNull(),
  endsAt: date("ends_at"),
  monthlyRent: numeric("monthly_rent", { precision: 14, scale: 0 }).notNull(),
  deposit: numeric("deposit", { precision: 14, scale: 0 }).notNull().default("0"),
  dueDay: integer("due_day").notNull().default(1),
  status: leaseStatus("status").notNull().default("active"),
  rules: text("rules"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("lease_organization_status_idx").on(table.organizationId, table.status),
  index("lease_room_dates_idx").on(table.roomId, table.startsAt, table.endsAt),
  index("lease_tenant_idx").on(table.tenantId),
]);

export const invoices = pgTable("invoice", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  leaseId: text("lease_id").notNull().references(() => leases.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  dueAt: date("due_at").notNull(),
  amount: numeric("amount", { precision: 14, scale: 0 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 0 }).notNull().default("0"),
  status: invoiceStatus("status").notNull().default("unpaid"),
  note: text("note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("invoice_lease_period_unique").on(table.leaseId, table.periodStart),
  index("invoice_organization_status_due_idx").on(table.organizationId, table.status, table.dueAt),
]);

export const invoiceItems = pgTable("invoice_item", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 0 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 0 }).notNull(),
  createdAt: createdAt(),
}, (table) => [index("invoice_item_invoice_idx").on(table.invoiceId)]);

export const payments = pgTable("payment", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 0 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  method: text("method").notNull().default("transfer"),
  reference: text("reference"),
  proofObjectKey: text("proof_object_key"),
  status: paymentStatus("status").notNull().default("verified"),
  verifiedBy: text("verified_by").references(() => authUsers.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: createdAt(),
}, (table) => [
  index("payment_organization_paid_at_idx").on(table.organizationId, table.paidAt),
  index("payment_invoice_idx").on(table.invoiceId),
]);

export const expenses = pgTable("expense", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  propertyId: text("property_id").notNull().references(() => properties.id, { onDelete: "restrict" }),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 14, scale: 0 }).notNull(),
  occurredAt: date("occurred_at").notNull(),
  vendor: text("vendor"),
  proofObjectKey: text("proof_object_key"),
  note: text("note"),
  createdBy: text("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (table) => [index("expense_organization_date_idx").on(table.organizationId, table.occurredAt)]);

export const utilityReadings = pgTable("utility_reading", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "restrict" }),
  periodStart: date("period_start").notNull(),
  meterType: text("meter_type").notNull(),
  startValue: numeric("start_value", { precision: 14, scale: 3 }).notNull(),
  endValue: numeric("end_value", { precision: 14, scale: 3 }).notNull(),
  rate: numeric("rate", { precision: 14, scale: 0 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 0 }).notNull(),
  correctionReason: text("correction_reason"),
  recordedBy: text("recorded_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("utility_room_period_type_unique").on(table.roomId, table.periodStart, table.meterType),
  index("utility_organization_period_idx").on(table.organizationId, table.periodStart),
]);

export const maintenanceTickets = pgTable("maintenance_ticket", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "restrict" }),
  assignedMemberId: text("assigned_member_id").references(() => members.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  priority: maintenancePriority("priority").notNull().default("normal"),
  status: maintenanceStatus("status").notNull().default("new"),
  photoObjectKey: text("photo_object_key"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("ticket_organization_status_idx").on(table.organizationId, table.status),
  index("ticket_assignee_idx").on(table.assignedMemberId),
]);

export const maintenanceComments = pgTable("maintenance_comment", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => maintenanceTickets.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
}, (table) => [index("maintenance_comment_ticket_idx").on(table.ticketId, table.createdAt)]);

export const auditLogs = pgTable("audit_log", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  changes: jsonb("changes").$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (table) => [index("audit_organization_created_idx").on(table.organizationId, table.createdAt)]);

export const invitations = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: memberRole("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (table) => [index("invitation_organization_idx").on(table.organizationId, table.email)]);

export const authSchema = {
  user: authUsers,
  session: authSessions,
  account: authAccounts,
  verification: authVerifications,
};

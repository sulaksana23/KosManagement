import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { members, organizations, tenants } from "@/db/schema";

export type WorkspaceContext = {
  userId: string;
  userName: string;
  userEmail: string;
  memberId: string;
  organizationId: string;
  organizationName: string;
  role: "owner" | "manager" | "finance" | "staff" | "tenant";
};

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireWorkspace(allowedRoles?: readonly WorkspaceContext["role"][]) {
  const session = await requireUser();
  const [membership] = await db
    .select({
      memberId: members.id,
      organizationId: organizations.id,
      organizationName: organizations.name,
      role: members.role,
    })
    .from(members)
    .innerJoin(organizations, eq(members.organizationId, organizations.id))
    .where(eq(members.userId, session.user.id))
    .limit(1);

  if (!membership) redirect("/setup");
  if (allowedRoles && !allowedRoles.includes(membership.role)) redirect("/forbidden");

  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    ...membership,
  } satisfies WorkspaceContext;
}


export async function requireTenantWorkspace() {
  const ctx = await requireWorkspace(["tenant"]);
  const [tenant] = await db.select().from(tenants).where(and(
    eq(tenants.organizationId, ctx.organizationId), eq(tenants.userId, ctx.userId),
  )).limit(1);
  if (!tenant) redirect("/forbidden");
  return { ...ctx, tenant };
}

import { AppShell } from "@/components/app-shell";
import { requireTenantWorkspace } from "@/server/context";

export default async function TenantLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireTenantWorkspace();
  return <AppShell userName={ctx.userName} workspaceName={ctx.organizationName} role={ctx.role}>{children}</AppShell>;
}

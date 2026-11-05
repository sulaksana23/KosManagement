import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/server/context";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireWorkspace(["owner", "manager", "finance", "staff"]);
  return <AppShell userName={ctx.userName} workspaceName={ctx.organizationName} role={ctx.role}>{children}</AppShell>;
}

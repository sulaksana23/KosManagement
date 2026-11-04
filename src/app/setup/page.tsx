import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { db } from "@/db";
import { members } from "@/db/schema";
import { createWorkspace } from "@/server/actions";
import { requireUser } from "@/server/context";
import { PageNotice, TextField } from "@/components/ui";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireUser();
  const [membership] = await db.select({ id: members.id }).from(members).where(eq(members.userId, session.user.id)).limit(1);
  if (membership) redirect("/dashboard");
  const params = await searchParams;
  return <main className="min-h-screen bg-[#f3f6f4] px-4 py-12">
    <div className="mx-auto max-w-[520px]">
      <div className="surface p-5 sm:p-7">
        <div className="mb-4 grid size-10 place-items-center rounded-xl bg-[#eaf3ed] text-[#245c49]"><Building2 size={20} /></div>
        <h1 className="m-0 text-xl font-bold">Buat workspace</h1>
        <p className="muted mb-5 mt-2 text-sm">Workspace mengelompokkan properti, anggota, dan data operasional Anda.</p>
        <PageNotice error={params.error} />
        <form action={createWorkspace} className="mt-4 grid gap-4">
          <TextField name="name" label="Nama workspace" placeholder="Contoh: Kos Bayu" required />
          <button className="btn btn-primary w-full">Buat workspace</button>
        </form>
      </div>
    </div>
  </main>;
}

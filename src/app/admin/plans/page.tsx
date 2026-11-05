import { desc, eq } from "drizzle-orm";
import { Check, X } from "lucide-react";
import { db } from "@/db";
import { authUsers, organizations, planRequests } from "@/db/schema";
import { EmptyState, PageHeading, PageNotice } from "@/components/ui";
import { reviewPlanRequest } from "@/server/actions";
import { requirePlatformAdmin } from "@/server/platform-admin";
import { formatDate } from "@/lib/format";

export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const requests = await db.select({
    request: planRequests,
    organizationName: organizations.name,
    requesterName: authUsers.name,
    requesterEmail: authUsers.email,
  }).from(planRequests)
    .innerJoin(organizations, eq(planRequests.organizationId, organizations.id))
    .innerJoin(authUsers, eq(planRequests.requestedBy, authUsers.id))
    .where(eq(planRequests.status, "pending"))
    .orderBy(desc(planRequests.createdAt)).limit(100);

  return <main className="mx-auto min-h-screen w-full max-w-5xl p-4 sm:p-8">
    <div className="page-stack">
      <PageHeading title="Tinjauan upgrade Pro" description="Permintaan upgrade workspace yang menunggu keputusan admin." />
      <PageNotice notice={params.notice} error={params.error} />
      <section className="surface overflow-hidden">
        <div className="border-b border-[#e8eeeb] px-4 py-3"><h2 className="surface-title m-0">Permintaan masuk</h2></div>
        {requests.length === 0 ? <EmptyState title="Tidak ada permintaan tertunda" description="Permintaan upgrade baru akan muncul di sini." /> : <div className="divide-y divide-[#e8eeeb]">
          {requests.map(({ request, organizationName, requesterName, requesterEmail }) => <article key={request.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="m-0 truncate font-semibold text-[#24372e]">{organizationName}</p>
              <p className="muted mb-0 mt-1 text-xs">{requesterName} · {requesterEmail} · {formatDate(request.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action={reviewPlanRequest} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="requestId" value={request.id} />
                <input className="input min-h-9 w-44" name="note" maxLength={500} placeholder="Catatan (opsional)" aria-label="Catatan tinjauan" />
                <button className="btn btn-primary" name="decision" value="approved"><Check size={15} />Setujui Pro</button>
                <button className="btn btn-secondary" name="decision" value="rejected"><X size={15} />Tolak</button>
              </form>
            </div>
          </article>)}
        </div>}
      </section>
      <p className="muted m-0 text-xs">Akses halaman ini dibatasi ke email admin pada KOSMANAGER_ADMIN_EMAILS.</p>
    </div>
  </main>;
}

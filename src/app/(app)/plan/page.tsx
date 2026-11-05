import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { BedDouble, Building2, Check, Crown, Users } from "lucide-react";
import { db } from "@/db";
import { invitations, members, organizations, planRequests, properties, rooms } from "@/db/schema";
import { PageHeading, PageNotice } from "@/components/ui";
import { createPlanRequest } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { PLAN_LIMITS, formatPlanLimit } from "@/lib/plans";
import { formatDate } from "@/lib/format";

function UsageRow({ label, icon: Icon, used, limit }: {
  label: string; icon: typeof Building2; used: number; limit: number | null;
}) {
  const percent = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return <div className="grid gap-1.5">
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-[#46584f]"><Icon size={15} />{label}</span>
      <span className="font-semibold text-[#21372e]">{used} / {formatPlanLimit(limit)}</span>
    </div>
    {limit !== null && <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)} className="h-1.5 overflow-hidden rounded-full bg-[#e7eee9]">
      <div className="h-full rounded-full bg-[#438363]" style={{ width: `${percent}%` }} />
    </div>}
  </div>;
}

const requestLabels = { pending: "Menunggu tinjauan", approved: "Disetujui", rejected: "Ditolak" } as const;

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner"]);
  const params = await searchParams;
  const [organizationRows, propertyRows, roomRows, memberRows, invitationRows, requestRows] = await Promise.all([
    db.select({ plan: organizations.plan }).from(organizations).where(eq(organizations.id, ctx.organizationId)).limit(1),
    db.select({ total: count() }).from(properties).where(eq(properties.organizationId, ctx.organizationId)),
    db.select({ total: count() }).from(rooms).where(eq(rooms.organizationId, ctx.organizationId)),
    db.select({ total: count() }).from(members).where(eq(members.organizationId, ctx.organizationId)),
    db.select({ total: count() }).from(invitations).where(and(
      eq(invitations.organizationId, ctx.organizationId), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()),
    )),
    db.select().from(planRequests).where(eq(planRequests.organizationId, ctx.organizationId)).orderBy(desc(planRequests.createdAt)).limit(1),
  ]);
  const plan = organizationRows[0]?.plan ?? "free";
  const latestRequest = requestRows[0];
  const usage = {
    properties: Number(propertyRows[0]?.total ?? 0),
    rooms: Number(roomRows[0]?.total ?? 0),
    members: Number(memberRows[0]?.total ?? 0) + Number(invitationRows[0]?.total ?? 0),
  };
  const limits = PLAN_LIMITS[plan];

  return <div className="page-stack">
    <PageHeading title="Paket & penggunaan" description="Pantau kuota workspace dan ajukan upgrade." action={<span className={plan === "pro" ? "badge badge-green" : "badge badge-gray"}>{plan === "pro" ? "Pro aktif" : "Free"}</span>} />
    <PageNotice notice={params.notice} error={params.error} />

    <section className="surface p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#e8eeeb] pb-3">
        <div><h2 className="surface-title m-0">Pemakaian workspace</h2><p className="muted mb-0 mt-1 text-xs">Undangan aktif ikut memakai kuota anggota.</p></div>
        {plan === "pro" && <Crown size={19} className="text-[#438363]" />}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <UsageRow label="Properti" icon={Building2} used={usage.properties} limit={limits.properties} />
        <UsageRow label="Kamar" icon={BedDouble} used={usage.rooms} limit={limits.rooms} />
        <UsageRow label="Anggota dan undangan" icon={Users} used={usage.members} limit={limits.members} />
      </div>
    </section>

    <section className="grid gap-3 md:grid-cols-2">
      <article className="surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="surface-title m-0">Free</h2><span className="badge badge-gray">{plan === "free" ? "Paket saat ini" : "Paket dasar"}</span></div>
        <ul className="grid gap-2 p-0 text-sm text-[#53645b]">
          <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#438363]" />1 properti dan 10 kamar</li>
          <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#438363]" />Maksimal 3 anggota, termasuk pemilik dan undangan aktif</li>
          <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#438363]" />Fitur operasional tetap tersedia sesuai kuota</li>
        </ul>
      </article>
      <article className="surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="surface-title m-0 flex items-center gap-2"><Crown size={16} />Pro</h2><span className="badge badge-green">Tanpa batas kuota</span></div>
        <ul className="grid gap-2 p-0 text-sm text-[#53645b]">
          <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#438363]" />Properti, kamar, dan anggota tanpa batas</li>
          <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#438363]" />Semua fitur operasional KosManager</li>
          <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[#438363]" />Aktivasi setelah permintaan disetujui admin</li>
        </ul>
      </article>
    </section>

    {latestRequest && <section className="surface p-3 text-sm">
      Permintaan Pro terakhir: <strong>{requestLabels[latestRequest.status]}</strong> · {formatDate(latestRequest.createdAt)}
      {latestRequest.reviewNote && <span className="block mt-1">Catatan admin: {latestRequest.reviewNote}</span>}
    </section>}

    {plan === "free" && latestRequest?.status !== "pending" && <section className="surface flex flex-wrap items-center justify-between gap-4 p-4">
      <div><h2 className="surface-title m-0">Butuh kapasitas lebih?</h2><p className="muted mb-0 mt-1 text-sm">Kirim permintaan upgrade. Admin akan meninjau dan mengaktifkan Pro secara manual.</p></div>
      <form action={createPlanRequest}><button className="btn btn-primary"><Crown size={15} />Ajukan upgrade Pro</button></form>
    </section>}
    {plan === "free" && latestRequest?.status === "pending" && <section className="surface p-4">
      <h2 className="surface-title m-0">Permintaan sedang ditinjau</h2>
      <p className="muted mb-0 mt-1 text-sm">Admin belum menyetujui upgrade ini. Anda masih dapat memakai fitur dalam batas Paket Free.</p>
    </section>}
    {plan === "pro" && <section className="surface p-4">
      <h2 className="surface-title m-0">Paket Pro aktif</h2>
      <p className="muted mb-0 mt-1 text-sm">Workspace ini sudah dapat menambah properti, kamar, dan anggota tanpa batas paket.</p>
    </section>}
  </div>;
}

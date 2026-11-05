import { and, desc, eq, inArray } from "drizzle-orm";
import { ClipboardList, Plus } from "lucide-react";
import { db } from "@/db";
import { properties, rooms, tenantApplications } from "@/db/schema";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, TextField } from "@/components/ui";
import {
  approveRentalApplication,
  createRentalApplication,
  rejectRentalApplication,
} from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";

const ROOM_STATUS_LABELS: Record<string, string> = {
  available: "Tersedia",
  reserved: "Dipesan",
  occupied: "Dihuni",
  maintenance: "Perawatan",
  inactive: "Nonaktif",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu ditinjau",
  approved: "Disetujui",
  rejected: "Ditolak",
};

function ApplicationStatus({ status }: { status: string }) {
  const tone = status === "approved" ? "badge-green" : status === "rejected" ? "badge-red" : "badge-amber";
  return <span className={"badge " + tone}>{STATUS_LABELS[status] ?? "Status tidak dikenal"}</span>;
}

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const [roomList, applicationList] = await Promise.all([
    db.select({
      id: rooms.id,
      code: rooms.code,
      status: rooms.status,
      rent: rooms.monthlyRent,
      propertyName: properties.name,
    }).from(rooms).innerJoin(properties, eq(rooms.propertyId, properties.id)).where(and(
      eq(rooms.organizationId, ctx.organizationId),
      eq(properties.organizationId, ctx.organizationId),
      inArray(rooms.status, ["available", "reserved", "occupied"]),
    )).orderBy(properties.name, rooms.code).limit(200),
    db.select({
      application: tenantApplications,
      roomCode: rooms.code,
      roomStatus: rooms.status,
      propertyName: properties.name,
    }).from(tenantApplications)
      .innerJoin(rooms, eq(tenantApplications.roomId, rooms.id))
      .innerJoin(properties, eq(rooms.propertyId, properties.id))
      .where(and(
        eq(tenantApplications.organizationId, ctx.organizationId),
        eq(rooms.organizationId, ctx.organizationId),
        eq(properties.organizationId, ctx.organizationId),
      ))
      .orderBy(desc(tenantApplications.createdAt))
      .limit(100),
  ]);

  return <div className="page-stack">
    <PageHeading title="Permohonan sewa" description="Catat calon penghuni dan tinjau permohonannya sebelum membuat kontrak." />
    <PageNotice notice={params.notice} error={params.error} />
    <FormCard title="Catat calon penghuni" description="Persetujuan membuat profil penghuni dan kontrak berdasarkan tarif serta deposit kamar saat disetujui.">
      {roomList.length === 0 ? <p className="muted m-0 text-sm">Tambahkan kamar yang bisa dijadwalkan terlebih dahulu.</p> : <form action={createRentalApplication} className="form-grid">
        <TextField name="fullName" label="Nama lengkap" required />
        <TextField name="phone" label="Nomor telepon" type="tel" required />
        <TextField name="email" label="Email" type="email" />
        <SelectField name="roomId" label="Kamar yang diminta" options={roomList.map((room) => ({
          value: room.id,
          label: room.propertyName + " · " + room.code + " · " + ROOM_STATUS_LABELS[room.status] + " · " + formatIDR(room.rent) + " / bulan",
        }))} required />
        <TextField name="desiredMoveIn" label="Tanggal rencana masuk" type="date" defaultValue={todayISO()} required />
        <TextField name="emergencyContactName" label="Nama kontak darurat" />
        <TextField name="emergencyContactPhone" label="Telepon kontak darurat" type="tel" />
        <div className="field form-span"><label htmlFor="application-note">Catatan permohonan</label><textarea className="input min-h-16" id="application-note" name="note" maxLength={500} /></div>
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Simpan permohonan</button></div>
      </form>}
    </FormCard>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><ClipboardList size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Permohonan terbaru</h2></div>
      {applicationList.length === 0 ? <EmptyState title="Belum ada permohonan" description="Permohonan calon penghuni yang dicatat akan tampil di sini." /> : <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>CALON PENGHUNI</th><th>KAMAR</th><th>TANGGAL MASUK</th><th>STATUS</th><th>CATATAN</th><th>TINDAKAN</th></tr></thead>
          <tbody>{applicationList.map(({ application, roomCode, roomStatus, propertyName }) => <tr key={application.id}>
            <td><div className="font-semibold">{application.fullName}</div><div className="muted text-xs">{application.phone}{application.email ? " · " + application.email : ""}</div>{application.emergencyContactName && <div className="muted text-xs">Darurat: {application.emergencyContactName} · {application.emergencyContactPhone ?? "—"}</div>}</td>
            <td>{propertyName} · {roomCode}<div className="muted text-xs">Status kamar: {ROOM_STATUS_LABELS[roomStatus] ?? roomStatus}</div></td>
            <td className="whitespace-nowrap">{formatDate(application.desiredMoveIn)}</td>
            <td><ApplicationStatus status={application.status} /></td>
            <td className="max-w-56 text-xs">{application.reviewNote ? "Alasan: " + application.reviewNote : application.note ?? "—"}</td>
            <td>{application.status === "pending" ? <div className="grid min-w-[210px] gap-2">
              <form action={approveRentalApplication}>
                <input type="hidden" name="applicationId" value={application.id} />
                <ConfirmSubmitButton className="btn btn-primary w-full" label="Setujui & buat kontrak" message="Setujui permohonan? Profil penghuni dan kontrak akan langsung dibuat." />
              </form>
              <form action={rejectRentalApplication} className="grid gap-1.5">
                <input type="hidden" name="applicationId" value={application.id} />
                <label className="sr-only" htmlFor={"review-note-" + application.id}>Alasan penolakan</label>
                <input className="input min-h-8 text-xs" id={"review-note-" + application.id} name="reviewNote" maxLength={500} placeholder="Alasan penolakan" required />
                <ConfirmSubmitButton className="btn btn-quiet w-full" label="Tolak permohonan" message="Tolak permohonan ini dan simpan alasannya?" />
              </form>
            </div> : application.status === "approved" && application.tenantId ? <span className="muted text-xs">Profil penghuni dan kontrak sudah dibuat.</span> : <span className="muted text-xs">Ditinjau {application.reviewedAt ? formatDate(application.reviewedAt) : "—"}</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </div>;
}

import { and, desc, eq, sum } from "drizzle-orm";
import { BedDouble, CalendarDays, CreditCard, Wrench } from "lucide-react";
import { db } from "@/db";
import { invoices, leases, maintenanceTickets, payments, properties, rooms } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, StatusBadge, TextField } from "@/components/ui";
import { createTenantTicket, submitTenantPayment } from "@/server/actions";
import { requireTenantWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";

export default async function TenantPortalPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireTenantWorkspace();
  const params = await searchParams;
  const today = todayISO();
  const [leaseList, invoiceList, paymentList, ticketList, pendingTotals] = await Promise.all([
    db.select({ lease: leases, roomCode: rooms.code, propertyName: properties.name })
      .from(leases).innerJoin(rooms, eq(leases.roomId, rooms.id)).innerJoin(properties, eq(rooms.propertyId, properties.id))
      .where(and(eq(leases.organizationId, ctx.organizationId), eq(rooms.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId), eq(leases.tenantId, ctx.tenant.id)))
      .orderBy(desc(leases.startsAt)).limit(20),
    db.select({ invoice: invoices, roomCode: rooms.code })
      .from(invoices).innerJoin(leases, eq(invoices.leaseId, leases.id)).innerJoin(rooms, eq(leases.roomId, rooms.id))
      .where(and(eq(invoices.organizationId, ctx.organizationId), eq(leases.organizationId, ctx.organizationId), eq(rooms.organizationId, ctx.organizationId), eq(leases.tenantId, ctx.tenant.id)))
      .orderBy(desc(invoices.dueAt)).limit(50),
    db.select({ payment: payments, invoiceId: invoices.id })
      .from(payments).innerJoin(invoices, eq(payments.invoiceId, invoices.id))
      .innerJoin(leases, eq(invoices.leaseId, leases.id))
      .where(and(eq(payments.organizationId, ctx.organizationId), eq(invoices.organizationId, ctx.organizationId), eq(leases.organizationId, ctx.organizationId), eq(leases.tenantId, ctx.tenant.id)))
      .orderBy(desc(payments.paidAt)).limit(50),
    db.select().from(maintenanceTickets).where(and(
      eq(maintenanceTickets.organizationId, ctx.organizationId), eq(maintenanceTickets.tenantId, ctx.tenant.id),
    )).orderBy(desc(maintenanceTickets.createdAt)).limit(50),
    db.select({ invoiceId: payments.invoiceId, total: sum(payments.amount) }).from(payments).innerJoin(invoices, eq(payments.invoiceId, invoices.id)).innerJoin(leases, eq(invoices.leaseId, leases.id))
      .where(and(eq(payments.organizationId, ctx.organizationId), eq(invoices.organizationId, ctx.organizationId), eq(leases.organizationId, ctx.organizationId), eq(leases.tenantId, ctx.tenant.id), eq(payments.status, "pending"))).groupBy(payments.invoiceId),
  ]);
  const pendingByInvoice = new Map(pendingTotals.map((row) => [row.invoiceId, BigInt(row.total ?? "0")]));
  const currentLeases = leaseList.filter(({ lease }) =>
    lease.status === "active" && lease.startsAt <= today && (!lease.endsAt || lease.endsAt >= today),
  );

  return <div className="page-stack">
    <PageHeading title="Portal penghuni" description={"Halo, " + ctx.tenant.fullName + ". Lihat kontrak, tagihan, dan keluhan Anda."} />
    <PageNotice notice={params.notice} error={params.error} />

    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><BedDouble size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Kontrak</h2></div>
      {leaseList.length === 0 ? <EmptyState title="Belum ada kontrak" description="Kontrak yang terhubung ke akun ini akan tampil di sini." /> : <div className="divide-y divide-[#eef2f0]">
        {leaseList.map(({ lease, roomCode, propertyName }) => <article key={lease.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="min-w-0"><p className="m-0 font-semibold text-[#24372e]">{propertyName} · Kamar {roomCode}</p><p className="muted mb-0 mt-1 text-xs">{formatDate(lease.startsAt)} – {lease.endsAt ? formatDate(lease.endsAt) : "Tanpa batas akhir"} · Jatuh tempo tiap tanggal {lease.dueDay}</p>{lease.rules && <p className="mb-0 mt-2 whitespace-pre-wrap text-xs text-[#53645b]">{lease.rules}</p>}</div>
          <div className="grid justify-items-end gap-1"><StatusBadge status={lease.status} /><span className="text-sm font-semibold">{formatIDR(lease.monthlyRent)} / bulan</span></div>
        </article>)}
      </div>}
    </section>

    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><CreditCard size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Tagihan</h2></div>
      {invoiceList.length === 0 ? <EmptyState title="Belum ada tagihan" description="Tagihan sewa akan tampil setelah pengelola membuatnya." /> : <div className="divide-y divide-[#eef2f0]">
        {invoiceList.map(({ invoice, roomCode }) => {
          const pendingAmount = pendingByInvoice.get(invoice.id) ?? BigInt(0);
          const balance = BigInt(invoice.amount) - BigInt(invoice.paidAmount);
          const availableToPay = balance - pendingAmount;
          const displayedStatus = balance > BigInt(0) && invoice.dueAt < today ? "overdue" : invoice.status;
          return <article key={invoice.id} className="grid gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="m-0 font-semibold text-[#24372e]">Kamar {roomCode} · Periode {formatDate(invoice.periodStart)}</p><p className="muted mb-0 mt-1 text-xs">Jatuh tempo {formatDate(invoice.dueAt)}</p></div>
              <StatusBadge status={displayedStatus} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs"><span>Total <strong>{formatIDR(invoice.amount)}</strong></span><span>Terbayar <strong>{formatIDR(invoice.paidAmount)}</strong></span><span>Sisa <strong>{formatIDR(balance)}</strong></span></div>
            {pendingAmount > BigInt(0) && <p className="notice m-0 border border-[#eadbb5] bg-[#fbf7ec] text-xs text-[#755b28]">Bukti {formatIDR(pendingAmount)} sedang menunggu verifikasi.</p>}
            {availableToPay > BigInt(0) && invoice.status !== "cancelled" && <form action={submitTenantPayment} className="grid gap-2 rounded-lg border border-[#e8eeeb] bg-[#fbfcfb] p-3 sm:grid-cols-[minmax(120px,180px)_minmax(180px,1fr)_auto] sm:items-end">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <TextField name="amount" label="Nominal bayar (Rp)" type="number" min="1" max={availableToPay.toString()} defaultValue={availableToPay.toString()} required />
              <TextField name="reference" label="Nomor referensi (opsional)" placeholder="Contoh: 123456" />
              <button className="btn btn-primary"><CreditCard size={14} />Laporkan pembayaran</button>
              <p className="muted m-0 text-[11px] sm:col-span-3">Pembayaran dicatat sebagai menunggu. Status tagihan berubah setelah pengelola memverifikasi transaksi.</p>
            </form>}
          </article>;
        })}
      </div>}
    </section>

    <section className="surface overflow-hidden">
      <div className="border-b border-[#e8eeeb] px-4 py-3"><h2 className="surface-title m-0">Riwayat pembayaran</h2></div>
      {paymentList.length === 0 ? <EmptyState title="Belum ada pembayaran" description="Konfirmasi pembayaran dan status verifikasinya akan tampil di sini." /> : <div className="divide-y divide-[#eef2f0]">
        {paymentList.map(({ payment, invoiceId }) => <article key={payment.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="m-0 font-semibold text-[#24372e]">{formatIDR(payment.amount)} · {formatDate(payment.paidAt)}</p><p className="muted mb-0 mt-1 text-xs">{payment.reference ? "Referensi " + payment.reference : "Tagihan " + invoiceId.slice(0, 8)}</p>{payment.note && payment.status === "rejected" && <p className="mb-0 mt-1 text-xs text-[#984b3c]">{payment.note}</p>}</div>
          <StatusBadge status={payment.status} />
        </article>)}
      </div>}
    </section>

    <div className="content-grid">
      <FormCard title="Kirim keluhan" description="Keluhan akan terkait dengan kamar pada kontrak aktif Anda.">
        {currentLeases.length === 0 ? <p className="muted m-0 text-sm">Keluhan baru dapat dikirim saat Anda memiliki kontrak aktif.</p> : <form action={createTenantTicket} className="grid gap-3">
          <SelectField name="category" label="Kategori" options={[
            { value: "Air", label: "Air" }, { value: "Listrik", label: "Listrik" },
            { value: "Fasilitas kamar", label: "Fasilitas kamar" }, { value: "Kebersihan", label: "Kebersihan" },
            { value: "Lainnya", label: "Lainnya" },
          ]} required />
          <label className="field"><span>Jelaskan keluhan</span><textarea className="textarea" name="description" maxLength={1000} required /></label>
          <button className="btn btn-primary w-fit"><Wrench size={14} />Kirim keluhan</button>
        </form>}
      </FormCard>
      <section className="surface overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><CalendarDays size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Status keluhan</h2></div>
        {ticketList.length === 0 ? <EmptyState title="Belum ada keluhan" description="Keluhan yang dikirim akan tercatat di sini." /> : <div className="divide-y divide-[#eef2f0]">
          {ticketList.map((ticket) => <article key={ticket.id} className="grid gap-1 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="m-0 font-semibold">{ticket.category}</p><StatusBadge status={ticket.status} /></div><p className="m-0 text-sm text-[#53645b]">{ticket.description}</p><p className="muted m-0 text-[11px]">{formatDate(ticket.createdAt)}</p></article>)}
        </div>}
      </section>
    </div>
  </div>;
}

import { desc, eq } from "drizzle-orm";
import { CreditCard, Plus } from "lucide-react";
import { db } from "@/db";
import { invoices, leases, payments, rooms, tenants } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, StatusBadge, TextField } from "@/components/ui";
import { createPayment, generateMonthlyInvoices } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const params = await searchParams;
  const [invoiceList, paymentList] = await Promise.all([
    db.select({ invoice: invoices, tenantName: tenants.fullName, roomCode: rooms.code })
      .from(invoices).innerJoin(leases, eq(invoices.leaseId, leases.id)).innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id))
      .where(eq(invoices.organizationId, ctx.organizationId)).orderBy(desc(invoices.dueAt)).limit(100),
    db.select({ payment: payments, tenantName: tenants.fullName, roomCode: rooms.code })
      .from(payments).innerJoin(invoices, eq(payments.invoiceId, invoices.id)).innerJoin(leases, eq(invoices.leaseId, leases.id)).innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id))
      .where(eq(payments.organizationId, ctx.organizationId)).orderBy(desc(payments.paidAt)).limit(20),
  ]);
  const currentMonth = todayISO().slice(0, 7);
  return <div className="page-stack">
    <PageHeading title="Tagihan & pembayaran" description="Buat tagihan bulanan dan catat pembayaran yang diverifikasi." />
    <PageNotice notice={params.notice} error={params.error} />
    <div className="content-grid">
      <FormCard title="Buat tagihan bulanan" description="Idempoten per kontrak dan periode; tagihan yang sudah ada dilewati.">
        <form action={generateMonthlyInvoices} className="flex flex-wrap items-end gap-3"><TextField name="month" label="Periode tagihan" type="month" defaultValue={currentMonth} required /><button className="btn btn-primary"><Plus size={15} />Buat tagihan</button></form>
      </FormCard>
      <FormCard title="Status tagihan" description="Status lunas hanya berubah setelah pembayaran dicatat petugas berizin.">
        <div className="flex flex-wrap gap-2"><StatusBadge status="unpaid" /><StatusBadge status="partial" /><StatusBadge status="paid" /><StatusBadge status="overdue" /></div>
      </FormCard>
    </div>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><CreditCard size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Daftar tagihan</h2></div>
      {invoiceList.length === 0 ? <EmptyState title="Belum ada tagihan" description="Buat kontrak aktif, lalu buat tagihan untuk periode berjalan." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>PENGHUNI</th><th>KAMAR</th><th>PERIODE</th><th>JATUH TEMPO</th><th>TOTAL</th><th>TERBAYAR</th><th>STATUS</th><th>CATAT PEMBAYARAN</th></tr></thead><tbody>{invoiceList.map(({ invoice, tenantName, roomCode }) => {
        const remaining = BigInt(invoice.amount) - BigInt(invoice.paidAmount);
        const displayedStatus = remaining > BigInt(0) && invoice.dueAt < todayISO() ? "overdue" : invoice.status;
        return <tr key={invoice.id}><td className="font-semibold">{tenantName}</td><td>{roomCode}</td><td>{formatDate(invoice.periodStart)}</td><td>{formatDate(invoice.dueAt)}</td><td>{formatIDR(invoice.amount)}</td><td>{formatIDR(invoice.paidAmount)}</td><td><StatusBadge status={displayedStatus} /></td><td>{remaining > BigInt(0) && invoice.status !== "cancelled" ? <form action={createPayment} className="flex min-w-[310px] items-center gap-1.5"><input type="hidden" name="invoiceId" value={invoice.id} /><input className="input min-h-8 w-28 px-2 py-1 text-[11px]" name="amount" type="number" min="1" max={remaining.toString()} defaultValue={remaining.toString()} aria-label="Nominal pembayaran" required /><select className="select min-h-8 w-[104px] px-2 py-1 text-[11px]" name="method" defaultValue="transfer" aria-label="Metode pembayaran"><option value="transfer">Transfer</option><option value="cash">Tunai</option><option value="qris">QRIS manual</option></select><button className="btn btn-quiet">Verifikasi</button></form> : <span className="text-[11px] text-[#82918b]">—</span>}</td></tr>;
      })}</tbody></table></div>}
    </section>
    <section className="surface overflow-hidden">
      <div className="border-b border-[#e8eeeb] px-4 py-3"><h2 className="surface-title m-0">Pembayaran terakhir</h2></div>
      {paymentList.length === 0 ? <EmptyState title="Belum ada pembayaran" description="Pembayaran yang dicatat akan muncul di sini." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>WAKTU</th><th>PENGHUNI</th><th>KAMAR</th><th>METODE</th><th>REFERENSI</th><th>NOMINAL</th><th>STATUS</th></tr></thead><tbody>{paymentList.map(({ payment, tenantName, roomCode }) => <tr key={payment.id}><td>{formatDate(payment.paidAt)}</td><td>{tenantName}</td><td>{roomCode}</td><td className="capitalize">{payment.method}</td><td>{payment.reference ?? "—"}</td><td className="font-semibold">{formatIDR(payment.amount)}</td><td><StatusBadge status={payment.status} /></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

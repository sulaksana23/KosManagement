import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { CreditCard, Plus } from "lucide-react";
import { db } from "@/db";
import { invoices, leases, payments, privateFiles, rooms, tenants } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, StatusBadge, TextField } from "@/components/ui";
import { createPayment, generateMonthlyInvoices, reviewTenantPayment } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CopyReminderButton } from "@/components/copy-reminder-button";
import { formatDate, formatIDR, todayISO } from "@/lib/format";
import { ListPagination } from "@/components/list-pagination";
import { DEFAULT_PAGE_SIZE, escapeLike, getPageCount, getPageOffset, normalizeSearch, parsePage } from "@/lib/pagination";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; q?: string; invoiceStatus?: string; paymentStatus?: string; invoicePage?: string; paymentPage?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager", "finance"]);
  const params = await searchParams;
  const q = normalizeSearch(params.q), invoicePage = parsePage(params.invoicePage), paymentPage = parsePage(params.paymentPage);
  const invoiceStatuses = ["unpaid", "partial", "paid", "overdue", "cancelled"], paymentStatuses = ["pending", "verified", "rejected"];
  const invoiceStatus = invoiceStatuses.includes(params.invoiceStatus ?? "") ? params.invoiceStatus! : "";
  const paymentStatus = paymentStatuses.includes(params.paymentStatus ?? "") ? params.paymentStatus! : "";
  const invoiceConditions = [eq(invoices.organizationId, ctx.organizationId), eq(leases.organizationId, ctx.organizationId), eq(tenants.organizationId, ctx.organizationId), eq(rooms.organizationId, ctx.organizationId)];
  if (invoiceStatus) invoiceConditions.push(eq(invoices.status, invoiceStatus as typeof invoices.$inferSelect.status));
  if (q) invoiceConditions.push(or(ilike(tenants.fullName, `%${escapeLike(q)}%`), ilike(rooms.code, `%${escapeLike(q)}%`))!);
  const paymentConditions = [eq(payments.organizationId, ctx.organizationId), eq(invoices.organizationId, ctx.organizationId), eq(leases.organizationId, ctx.organizationId), eq(tenants.organizationId, ctx.organizationId), eq(rooms.organizationId, ctx.organizationId)];
  if (paymentStatus) paymentConditions.push(eq(payments.status, paymentStatus as typeof payments.$inferSelect.status));
  if (q) paymentConditions.push(or(ilike(tenants.fullName, `%${escapeLike(q)}%`), ilike(rooms.code, `%${escapeLike(q)}%`), ilike(payments.reference, `%${escapeLike(q)}%`))!);
  const invoiceWhere = and(...invoiceConditions), paymentWhere = and(...paymentConditions);
  const [invoiceList, paymentList, invoiceCountRows, paymentCountRows] = await Promise.all([
    db.select({ invoice: invoices, tenantName: tenants.fullName, roomCode: rooms.code })
      .from(invoices).innerJoin(leases, eq(invoices.leaseId, leases.id)).innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id))
      .where(invoiceWhere).orderBy(desc(invoices.dueAt)).limit(DEFAULT_PAGE_SIZE).offset(getPageOffset(invoicePage)),
    db.select({ payment: payments, tenantName: tenants.fullName, roomCode: rooms.code, proofFileId: privateFiles.id })
      .from(payments).leftJoin(privateFiles, and(eq(privateFiles.paymentId, payments.id), eq(privateFiles.organizationId, ctx.organizationId))).innerJoin(invoices, eq(payments.invoiceId, invoices.id)).innerJoin(leases, eq(invoices.leaseId, leases.id)).innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id))
      .where(paymentWhere).orderBy(desc(payments.paidAt)).limit(DEFAULT_PAGE_SIZE).offset(getPageOffset(paymentPage)),
    db.select({ total: count() }).from(invoices).innerJoin(leases, eq(invoices.leaseId, leases.id)).innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id)).where(invoiceWhere),
    db.select({ total: count() }).from(payments).innerJoin(invoices, eq(payments.invoiceId, invoices.id)).innerJoin(leases, eq(invoices.leaseId, leases.id)).innerJoin(tenants, eq(leases.tenantId, tenants.id)).innerJoin(rooms, eq(leases.roomId, rooms.id)).where(paymentWhere),
  ]);
  const invoicePageCount = getPageCount(Number(invoiceCountRows[0]?.total ?? 0));
  const paymentPageCount = getPageCount(Number(paymentCountRows[0]?.total ?? 0));
  const currentInvoicePage = Math.min(invoicePage, invoicePageCount), currentPaymentPage = Math.min(paymentPage, paymentPageCount);
  const today = todayISO();
  const reminderThrough = new Date(`${today}T00:00:00Z`);
  reminderThrough.setUTCDate(reminderThrough.getUTCDate() + 7);
  const reminderThroughDate = reminderThrough.toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  return <div className="page-stack">
    <PageHeading title="Tagihan & pembayaran" description="Buat tagihan, verifikasi pembayaran, dan salin pesan pengingat untuk dikirim secara manual." />
    <PageNotice notice={params.notice} error={params.error} />
    <form method="get" className="surface flex flex-wrap items-end gap-3 p-3"><label className="field min-w-[210px] flex-1"><span>Cari penghuni, kamar, atau referensi</span><input className="input" name="q" defaultValue={q} placeholder="Nama, kamar, referensi" /></label><label className="field min-w-[160px]"><span>Status tagihan</span><select className="select" name="invoiceStatus" defaultValue={invoiceStatus}><option value="">Semua status</option>{invoiceStatuses.map((value) => <option key={value} value={value}>{value === "unpaid" ? "Menunggu" : value === "partial" ? "Sebagian" : value === "paid" ? "Lunas" : value === "overdue" ? "Terlambat" : "Dibatalkan"}</option>)}</select></label><label className="field min-w-[160px]"><span>Status pembayaran</span><select className="select" name="paymentStatus" defaultValue={paymentStatus}><option value="">Semua status</option>{paymentStatuses.map((value) => <option key={value} value={value}>{value === "pending" ? "Menunggu" : value === "verified" ? "Terverifikasi" : "Ditolak"}</option>)}</select></label><button className="btn btn-secondary">Terapkan</button><a className="btn btn-quiet" href="/billing">Reset</a></form>
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
      {invoiceList.length === 0 ? <EmptyState title={q || invoiceStatus ? "Tagihan tidak ditemukan" : "Belum ada tagihan"} description={q || invoiceStatus ? "Ubah pencarian atau filter status." : "Buat kontrak aktif, lalu buat tagihan untuk periode berjalan."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>PENGHUNI</th><th>KAMAR</th><th>PERIODE</th><th>JATUH TEMPO</th><th>TOTAL</th><th>TERBAYAR</th><th>STATUS</th><th>TINDAK LANJUT</th><th>CATAT PEMBAYARAN</th></tr></thead><tbody>{invoiceList.map(({ invoice, tenantName, roomCode }) => {
        const remaining = BigInt(invoice.amount) - BigInt(invoice.paidAmount);
        const displayedStatus = remaining > BigInt(0) && invoice.status !== "cancelled" && invoice.dueAt < today ? "overdue" : invoice.status;
        const isReminderEligible = remaining > BigInt(0) && invoice.status !== "cancelled" && invoice.dueAt <= reminderThroughDate;
        const daysLate = Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${invoice.dueAt}T00:00:00Z`)) / 86_400_000));
        const reminderMessage = `Halo ${tenantName}, kami mengingatkan tagihan kos kamar ${roomCode} periode ${formatDate(invoice.periodStart)}. Saldo tagihan yang tercatat saat ini ${formatIDR(remaining)}. ${invoice.dueAt < today ? `Tagihan ini terlambat ${daysLate} hari sejak ${formatDate(invoice.dueAt)}.` : `Jatuh tempo pada ${formatDate(invoice.dueAt)}.`} Jika Anda sudah mengirim konfirmasi pembayaran, tidak perlu membayar ulang; kami akan memeriksanya. Terima kasih.`;
        return <tr key={invoice.id}><td className="font-semibold">{tenantName}</td><td>{roomCode}</td><td>{formatDate(invoice.periodStart)}</td><td>{formatDate(invoice.dueAt)}</td><td>{formatIDR(invoice.amount)}</td><td>{formatIDR(invoice.paidAmount)}</td><td><StatusBadge status={displayedStatus} /></td><td>{isReminderEligible ? <CopyReminderButton message={reminderMessage} recipient={tenantName} /> : <span className="text-[11px] text-[#82918b]">—</span>}</td><td>{remaining > BigInt(0) && invoice.status !== "cancelled" ? <form action={createPayment} className="flex min-w-[310px] items-center gap-1.5"><input type="hidden" name="invoiceId" value={invoice.id} /><input className="input min-h-8 w-28 px-2 py-1 text-[11px]" name="amount" type="number" min="1" max={remaining.toString()} defaultValue={remaining.toString()} aria-label="Nominal pembayaran" required /><select className="select min-h-8 w-[104px] px-2 py-1 text-[11px]" name="method" defaultValue="transfer" aria-label="Metode pembayaran"><option value="transfer">Transfer</option><option value="cash">Tunai</option><option value="qris">QRIS manual</option></select><button className="btn btn-quiet">Verifikasi</button></form> : <span className="text-[11px] text-[#82918b]">—</span>}</td></tr>;
      })}</tbody></table></div>}
      <ListPagination pathname="/billing" params={{ q: q || undefined, invoiceStatus: invoiceStatus || undefined, paymentStatus: paymentStatus || undefined, paymentPage: paymentPage > 1 ? String(paymentPage) : undefined }} page={currentInvoicePage} pageCount={invoicePageCount} pageKey="invoicePage" />
    </section>
    <section className="surface overflow-hidden">
      <div className="border-b border-[#e8eeeb] px-4 py-3"><h2 className="surface-title m-0">Pembayaran terakhir</h2></div>
      {paymentList.length === 0 ? <EmptyState title={q || paymentStatus ? "Pembayaran tidak ditemukan" : "Belum ada pembayaran"} description={q || paymentStatus ? "Ubah pencarian atau filter status." : "Pembayaran yang dicatat atau dikirim dari portal akan muncul di sini."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>WAKTU</th><th>PENGHUNI</th><th>KAMAR</th><th>METODE</th><th>REFERENSI</th><th>NOMINAL</th><th>STATUS</th><th>TINJAUAN</th></tr></thead><tbody>{paymentList.map(({ payment, tenantName, roomCode, proofFileId }) => <tr key={payment.id}><td>{formatDate(payment.paidAt)}</td><td>{tenantName}</td><td>{roomCode}</td><td className="capitalize">{payment.method}</td><td>{payment.reference ?? "—"}{proofFileId && <a className="mt-1 block text-xs text-[#39795a] underline" href={`/api/private-files/${proofFileId}`}>Lihat bukti</a>}</td><td className="font-semibold">{formatIDR(payment.amount)}</td><td><StatusBadge status={payment.status} /></td><td>{payment.status === "pending" ? <form action={reviewTenantPayment} className="flex min-w-[300px] flex-wrap items-center gap-1.5"><input type="hidden" name="paymentId" value={payment.id} /><input className="input min-h-8 w-36 px-2 py-1 text-[11px]" name="note" maxLength={500} placeholder="Alasan jika ditolak" aria-label="Alasan penolakan" /><ConfirmSubmitButton className="btn btn-primary" label="Verifikasi" message="Verifikasi pembayaran ini dan masukkan nominalnya ke tagihan?" name="decision" value="verify" /><ConfirmSubmitButton className="btn btn-quiet" label="Tolak" message="Tolak konfirmasi pembayaran ini?" name="decision" value="reject" /></form> : <span className="text-[11px] text-[#82918b]">{payment.status === "verified" ? "Sudah diverifikasi" : "Ditolak"}</span>}</td></tr>)}</tbody></table></div>}
      <ListPagination pathname="/billing" params={{ q: q || undefined, invoiceStatus: invoiceStatus || undefined, paymentStatus: paymentStatus || undefined, invoicePage: invoicePage > 1 ? String(invoicePage) : undefined }} page={currentPaymentPage} pageCount={paymentPageCount} pageKey="paymentPage" />
    </section>
  </div>;
}

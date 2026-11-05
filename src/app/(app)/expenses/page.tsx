import { and, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { Plus, Wallet } from "lucide-react";
import { db } from "@/db";
import { expenses, properties } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, TextField } from "@/components/ui";
import { createExpense } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";
import { ListPagination } from "@/components/list-pagination";
import { DEFAULT_PAGE_SIZE, escapeLike, getPageCount, getPageOffset, normalizeSearch, parsePage } from "@/lib/pagination";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string; q?: string; propertyId?: string; from?: string; to?: string; page?: string }> }) {
  const ctx = await requireWorkspace(["owner", "finance"]);
  const params = await searchParams;
  const today = todayISO(), defaultFrom = `${today.slice(0, 7)}-01`;
  const dateValue = (value: string | undefined, fallback: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
  const q = normalizeSearch(params.q), propertyId = params.propertyId ?? "", from = dateValue(params.from, defaultFrom), to = dateValue(params.to, today), page = parsePage(params.page);
  const end = from <= to ? to : from;
  const conditions = [eq(expenses.organizationId, ctx.organizationId), eq(properties.organizationId, ctx.organizationId), gte(expenses.occurredAt, from), lte(expenses.occurredAt, end)];
  if (propertyId) conditions.push(eq(expenses.propertyId, propertyId));
  if (q) conditions.push(or(ilike(expenses.category, `%${escapeLike(q)}%`), ilike(expenses.vendor, `%${escapeLike(q)}%`), ilike(expenses.note, `%${escapeLike(q)}%`))!);
  const where = and(...conditions);
  const [propertyList, list, countRows] = await Promise.all([
    db.select({ id: properties.id, name: properties.name }).from(properties).where(eq(properties.organizationId, ctx.organizationId)).orderBy(properties.name),
    db.select({ expense: expenses, propertyName: properties.name }).from(expenses).innerJoin(properties, eq(expenses.propertyId, properties.id)).where(where).orderBy(desc(expenses.occurredAt)).limit(DEFAULT_PAGE_SIZE).offset(getPageOffset(page)),
    db.select({ total: count() }).from(expenses).innerJoin(properties, eq(expenses.propertyId, properties.id)).where(where),
  ]);
  const pageCount = getPageCount(Number(countRows[0]?.total ?? 0));
  const currentPage = Math.min(page, pageCount);
  return <div className="page-stack">
    <PageHeading title="Biaya operasional" description="Catat pengeluaran setiap properti dengan tanggal dan pemasok." />
    <PageNotice notice={params.notice} error={params.error} />
    <form method="get" className="surface flex flex-wrap items-end gap-3 p-3"><label className="field min-w-[200px] flex-1"><span>Cari biaya</span><input className="input" name="q" defaultValue={q} placeholder="Kategori, pemasok, catatan" /></label><label className="field min-w-[170px]"><span>Properti</span><select className="select" name="propertyId" defaultValue={propertyId}><option value="">Semua properti</option>{propertyList.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><TextField name="from" label="Dari tanggal" type="date" defaultValue={from} /><TextField name="to" label="Sampai tanggal" type="date" defaultValue={end} /><button className="btn btn-secondary">Terapkan</button><a className="btn btn-quiet" href="/expenses">Reset</a></form>
    <FormCard title="Catat biaya" description="Catat nominal, kategori, dan pemasok untuk laporan workspace.">
      {propertyList.length === 0 ? <p className="muted m-0 text-sm">Tambahkan properti terlebih dahulu.</p> : <form action={createExpense} className="form-grid">
        <SelectField name="propertyId" label="Properti" options={propertyList.map((property) => ({ value: property.id, label: property.name }))} required />
        <TextField name="category" label="Kategori" placeholder="Listrik, air, perbaikan" required />
        <TextField name="amount" label="Nominal (Rp)" type="number" min="0" step="1" required />
        <TextField name="occurredAt" label="Tanggal transaksi" type="date" defaultValue={todayISO()} required />
        <TextField name="vendor" label="Pemasok" />
        <TextField name="note" label="Catatan" />
        <div className="form-span"><button className="btn btn-primary"><Plus size={15} />Simpan biaya</button></div>
      </form>}
    </FormCard>
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#e8eeeb] px-4 py-3"><Wallet size={16} className="text-[#438363]" /><h2 className="surface-title m-0">Riwayat biaya</h2></div>
      {list.length === 0 ? <EmptyState title={q || propertyId ? "Biaya tidak ditemukan" : "Belum ada biaya"} description={q || propertyId ? "Ubah kata kunci, properti, atau rentang tanggal." : "Biaya yang Anda catat akan tampil di daftar ini."} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>TANGGAL</th><th>PROPERTI</th><th>KATEGORI</th><th>PEMASOK</th><th>CATATAN</th><th>NOMINAL</th></tr></thead><tbody>{list.map(({ expense, propertyName }) => <tr key={expense.id}><td>{formatDate(expense.occurredAt)}</td><td>{propertyName}</td><td className="font-semibold">{expense.category}</td><td>{expense.vendor ?? "—"}</td><td>{expense.note ?? "—"}</td><td className="font-semibold">{formatIDR(expense.amount)}</td></tr>)}</tbody></table></div>}
      <ListPagination pathname="/expenses" params={{ q: q || undefined, propertyId: propertyId || undefined, from, to: end }} page={currentPage} pageCount={pageCount} />
    </section>
  </div>;
}

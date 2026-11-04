import { desc, eq } from "drizzle-orm";
import { Plus, Wallet } from "lucide-react";
import { db } from "@/db";
import { expenses, properties } from "@/db/schema";
import { EmptyState, FormCard, PageHeading, PageNotice, SelectField, TextField } from "@/components/ui";
import { createExpense } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { formatDate, formatIDR, todayISO } from "@/lib/format";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "finance"]);
  const params = await searchParams;
  const [propertyList, list] = await Promise.all([
    db.select({ id: properties.id, name: properties.name }).from(properties).where(eq(properties.organizationId, ctx.organizationId)).orderBy(properties.name),
    db.select({ expense: expenses, propertyName: properties.name }).from(expenses).innerJoin(properties, eq(expenses.propertyId, properties.id)).where(eq(expenses.organizationId, ctx.organizationId)).orderBy(desc(expenses.occurredAt)).limit(100),
  ]);
  return <div className="page-stack">
    <PageHeading title="Biaya operasional" description="Catat pengeluaran setiap properti dengan tanggal dan pemasok." />
    <PageNotice notice={params.notice} error={params.error} />
    <FormCard title="Catat biaya" description="Simpan bukti transaksi secara privat setelah storage dikonfigurasi.">
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
      {list.length === 0 ? <EmptyState title="Belum ada biaya" description="Biaya yang Anda catat akan tampil di daftar ini." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>TANGGAL</th><th>PROPERTI</th><th>KATEGORI</th><th>PEMASOK</th><th>CATATAN</th><th>NOMINAL</th></tr></thead><tbody>{list.map(({ expense, propertyName }) => <tr key={expense.id}><td>{formatDate(expense.occurredAt)}</td><td>{propertyName}</td><td className="font-semibold">{expense.category}</td><td>{expense.vendor ?? "—"}</td><td>{expense.note ?? "—"}</td><td className="font-semibold">{formatIDR(expense.amount)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

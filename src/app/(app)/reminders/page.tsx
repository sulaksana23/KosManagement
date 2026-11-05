import { BellRing, Clock3 } from "lucide-react";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { PageHeading, PageNotice, SelectField, TextField } from "@/components/ui";
import { updateReminderSettings } from "@/server/actions";
import { requireWorkspace } from "@/server/context";
import { eq } from "drizzle-orm";

export default async function RemindersPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const ctx = await requireWorkspace(["owner", "manager"]);
  const params = await searchParams;
  const [settings] = await db.select({ enabled: organizations.remindersEnabled, before: organizations.reminderDaysBefore, after: organizations.reminderDaysAfter })
    .from(organizations).where(eq(organizations.id, ctx.organizationId)).limit(1);
  return <div className="page-stack">
    <PageHeading title="Pengingat tagihan" description="Atur email pengingat untuk tagihan yang belum lunas." />
    <PageNotice notice={params.notice} error={params.error} />
    <section className="surface p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3"><div className="grid size-9 place-items-center rounded-lg bg-[#eaf3ed] text-[#438363]"><BellRing size={18} /></div><div><h2 className="surface-title m-0">Jadwal pengingat</h2><p className="muted mb-0 mt-1 text-xs">Tanggal dihitung berdasarkan zona waktu properti. Email hanya dikirim untuk tagihan yang masih memiliki saldo.</p></div></div>
      <form action={updateReminderSettings} className="grid max-w-2xl gap-4">
        <SelectField name="enabled" label="Status pengingat" defaultValue={settings?.enabled ? "on" : "off"} options={[{ value: "on", label: "Aktif" }, { value: "off", label: "Nonaktif" }]} required />
        <TextField name="daysBefore" label="Hari sebelum jatuh tempo" defaultValue={(settings?.before ?? []).join(", ")} placeholder="3, 1" />
        <p className="muted -mt-3 text-xs">Pisahkan angka dengan koma; maksimal 5 jadwal, 1–30 hari. Kosongkan untuk menonaktifkan pengingat sebelum jatuh tempo.</p>
        <TextField name="daysAfter" label="Hari setelah jatuh tempo" defaultValue={(settings?.after ?? []).join(", ")} placeholder="1, 7" />
        <p className="muted -mt-3 text-xs">Contoh: 1, 7 berarti pengingat sehari dan seminggu setelah jatuh tempo.</p>
        <button className="btn btn-primary w-fit"><Clock3 size={15} />Simpan jadwal</button>
      </form>
    </section>
    <p className="notice m-0 text-sm">Pengiriman otomatis memerlukan <code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code>, dan <code>CRON_SECRET</code> pada environment deployment. Saat konfigurasi belum lengkap, email tidak dikirim dan kegagalan tercatat untuk percobaan ulang.</p>
  </div>;
}

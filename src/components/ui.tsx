import { CheckCircle2, CircleAlert, Inbox } from "lucide-react";

export function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><h1 className="page-title">{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

export function PageNotice({ notice, error }: { notice?: string; error?: string }) {
  if (error) return <div className="notice notice-error flex items-center gap-2"><CircleAlert size={16} />{error}</div>;
  if (notice) return <div className="notice notice-success flex items-center gap-2"><CheckCircle2 size={16} />{notice}</div>;
  return null;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty"><div className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-[#f1f5f3] text-[#819089]"><Inbox size={18} /></div><p className="m-0 font-semibold text-[#43564e]">{title}</p><p className="mb-0 mt-1">{description}</p></div>;
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    available: "Tersedia", reserved: "Dipesan", occupied: "Dihuni", maintenance: "Perawatan", inactive: "Nonaktif",
    draft: "Draf", active: "Aktif", ended: "Berakhir", cancelled: "Dibatalkan", unpaid: "Menunggu", partial: "Sebagian", paid: "Lunas", overdue: "Terlambat",
    pending: "Menunggu verifikasi", verified: "Terverifikasi", rejected: "Ditolak", new: "Baru", in_progress: "Diproses", waiting_tenant: "Menunggu penghuni", completed: "Selesai",
    low: "Rendah", normal: "Normal", high: "Tinggi", urgent: "Mendesak",
  };
  const tone = ["available", "occupied", "active", "paid", "verified", "completed"].includes(status) ? "badge-green"
    : ["reserved", "partial", "pending", "in_progress", "normal", "waiting_tenant"].includes(status) ? "badge-amber"
      : ["overdue", "rejected", "urgent", "cancelled"].includes(status) ? "badge-red" : "badge-gray";
  return <span className={`badge ${tone}`}>{labels[status] ?? status}</span>;
}

export function TextField({ label, name, type = "text", required = false, defaultValue, placeholder, min, max, step }: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string; min?: string; max?: string; step?: string;
}) {
  return <div className="field"><label htmlFor={name}>{label}{required && <span className="text-[#a84f42]"> *</span>}</label><input className="input" id={name} name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} min={min} max={max} step={step} /></div>;
}

export function SelectField({ label, name, options, required = false, defaultValue }: { label: string; name: string; options: { value: string; label: string }[]; required?: boolean; defaultValue?: string }) {
  return <div className="field"><label htmlFor={name}>{label}{required && <span className="text-[#a84f42]"> *</span>}</label><select className="select" id={name} name={name} required={required} defaultValue={defaultValue ?? ""}><option value="">Pilih {label.toLowerCase()}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

export function FormCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="surface p-4 sm:p-5"><div className="mb-4"><h2 className="surface-title m-0">{title}</h2>{description && <p className="muted mb-0 mt-1 text-xs">{description}</p>}</div>{children}</section>;
}

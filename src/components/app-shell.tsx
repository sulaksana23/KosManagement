"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Building2, CreditCard, FileText, LayoutDashboard, LogOut, ClipboardList, UserPlus,
  Menu, Receipt, Settings, Users, Wallet, Wrench, X, Home, Crown, BellRing,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

const navigation = [
  { label: "Ringkasan", href: "/dashboard", icon: LayoutDashboard, roles: ["owner", "manager", "finance", "staff"] },
  { label: "Properti", href: "/properties", icon: Building2, roles: ["owner", "manager"] },
  { label: "Kamar", href: "/rooms", icon: Home, roles: ["owner", "manager", "staff"] },
  { label: "Penghuni", href: "/tenants", icon: Users, roles: ["owner", "manager"] },
  { label: "Permohonan", href: "/applications", icon: UserPlus, roles: ["owner", "manager"] },
  { label: "Kontrak", href: "/leases", icon: FileText, roles: ["owner", "manager"] },
  { label: "Tagihan & bayar", href: "/billing", icon: CreditCard, roles: ["owner", "manager", "finance"] },
  { label: "Pengingat", href: "/reminders", icon: BellRing, roles: ["owner", "manager"] },
  { label: "Meter utilitas", href: "/utilities", icon: Receipt, roles: ["owner", "manager", "finance"] },
  { label: "Biaya", href: "/expenses", icon: Wallet, roles: ["owner", "finance"] },
  { label: "Perawatan", href: "/maintenance", icon: Wrench, roles: ["owner", "manager", "staff"] },
  { label: "Laporan", href: "/reports", icon: Settings, roles: ["owner", "manager", "finance"] },
  { label: "Riwayat aktivitas", href: "/activity", icon: ClipboardList, roles: ["owner", "manager"] },
  { label: "Anggota", href: "/team", icon: Users, roles: ["owner"] },
  { label: "Paket", href: "/plan", icon: Crown, roles: ["owner"] },
  { label: "Portal penghuni", href: "/tenant", icon: Home, roles: ["tenant"] },
];

type Props = { children: React.ReactNode; userName: string; workspaceName: string; role: string };

const roleLabels: Record<string, string> = { owner: "Pemilik", manager: "Pengelola", finance: "Keuangan", staff: "Staf", tenant: "Penghuni" };

export function AppShell({ children, userName, workspaceName, role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <div className="app-frame">
    {open && <button aria-label="Tutup navigasi" className="mobile-overlay" onClick={() => setOpen(false)} />}
    <header className="mobile-topbar">
      <button className="btn btn-secondary" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={17} /></button>
      <span className="font-semibold">KosManager</span>
      <button className="btn btn-secondary" aria-label="Tutup menu" onClick={signOut} disabled={signingOut}><LogOut size={16} /></button>
    </header>
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="flex items-center gap-3 px-2">
        <div className="grid size-9 place-items-center rounded-[10px] bg-[#b9d9c8] text-[#17312d]"><Building2 size={20} /></div>
        <div><div className="text-[16px] font-bold">KosManager</div><div className="text-[9px] tracking-[.13em] text-[#9fb4aa]">PENGELOLAAN KOS</div></div>
        <button className="ml-auto grid size-8 place-items-center rounded-md text-[#c0cec8] hover:bg-[#294a42] md:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={17} /></button>
      </div>
      <div className="nav-section">MENU UTAMA</div>
      <nav className="grid gap-1">
        {navigation.filter((item) => item.roles.includes(role)).map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
          return <Link key={href} href={href} onClick={() => setOpen(false)} className={`nav-link ${active ? "nav-link-active" : ""}`}>
            <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className="mt-auto border-t border-[#35544b] pt-4">
        <div className="flex items-center gap-2.5 px-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d4b79e] text-[10px] font-bold text-[#49382d]">{userName.slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#f0f6f2]">{userName}</p><p className="truncate text-[10px] text-[#a7bab1]">{workspaceName} · {roleLabels[role] ?? role}</p></div>
          <button onClick={signOut} disabled={signingOut} className="grid size-8 place-items-center rounded-md text-[#aec0b7] hover:bg-[#294a42]" title="Keluar"><LogOut size={16} /></button>
        </div>
      </div>
    </aside>
    <main className="main-area">
      <div className="main-content">{children}</div>
    </main>
  </div>;
}

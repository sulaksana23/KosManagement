import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KosManager", template: "%s · KosManager" },
  description: "Kelola properti kos, kamar, penghuni, kontrak, dan tagihan dalam satu tempat.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}

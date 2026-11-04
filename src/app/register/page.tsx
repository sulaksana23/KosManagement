import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Daftar" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const params = await searchParams;
  return <AuthForm mode="register" invitationToken={params.invitation} />;
}

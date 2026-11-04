import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Masuk" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ invitation?: string }> }) {
  const params = await searchParams;
  return <AuthForm mode="login" invitationToken={params.invitation} />;
}

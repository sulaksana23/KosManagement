import { notFound } from "next/navigation";
import { requireUser } from "@/server/context";

export async function requirePlatformAdmin() {
  const session = await requireUser();
  const adminEmails = (process.env.KOSMANAGER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(session.user.email.toLowerCase())) notFound();

  return { userId: session.user.id };
}

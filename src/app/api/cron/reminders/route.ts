import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendInvoiceReminders } from "@/server/reminder-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request, secret: string) {
  const value = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const providedBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi." }, { status: 503 });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  try {
    const summary = await sendInvoiceReminders();
    return NextResponse.json({ ok: true, ...summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[cron/reminders] Pengingat gagal diproses.", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Pengingat gagal diproses." }, { status: 500 });
  }
}

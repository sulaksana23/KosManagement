import "server-only";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
};

/** Kirim lewat Resend. Kredensial dan domain pengirim harus diatur di environment. */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("[email] Provider menolak pengiriman email.", { status: response.status });
    throw new Error("EMAIL_PROVIDER_FAILED");
  }
  return true;
}

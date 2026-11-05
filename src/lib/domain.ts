const MAX_MONEY = BigInt("99999999999999");

export function parseMeterMilli(raw: string): bigint | null {
  const match = /^(\d{1,11})(?:\.(\d{1,3}))?$/.exec(raw);
  if (!match) return null;
  return BigInt(match[1]) * BigInt(1000) + BigInt((match[2] ?? "").padEnd(3, "0") || "0");
}

export function calculateUtilityAmount(startRaw: string, endRaw: string, rateRaw: string): bigint | null {
  const start = parseMeterMilli(startRaw);
  const end = parseMeterMilli(endRaw);
  if (start === null || end === null || end < start || !/^\d{1,14}$/.test(rateRaw)) return null;
  const amount = ((end - start) * BigInt(rateRaw) + BigInt(999)) / BigInt(1000);
  return amount <= MAX_MONEY ? amount : null;
}

export function applyInvoicePayment(totalRaw: string, paidRaw: string, paymentRaw: string) {
  if (![totalRaw, paidRaw, paymentRaw].every((value) => /^\d{1,14}$/.test(value))) return null;
  const total = BigInt(totalRaw);
  const paid = BigInt(paidRaw);
  const payment = BigInt(paymentRaw);
  if (total <= BigInt(0) || paid < BigInt(0) || paid >= total || payment <= BigInt(0) || payment > total - paid) return null;
  const paidAmount = paid + payment;
  return {
    paidAmount: paidAmount.toString(),
    status: paidAmount === total ? "paid" as const : "partial" as const,
  };
}

export function calculateDepositSettlement(heldRaw: string, refundedRaw: string) {
  if (![heldRaw, refundedRaw].every((value) => /^\d{1,14}$/.test(value))) return null;
  const held = BigInt(heldRaw);
  const refunded = BigInt(refundedRaw);
  if (refunded > held) return null;
  return { refunded: refunded.toString(), withheld: (held - refunded).toString() };
}

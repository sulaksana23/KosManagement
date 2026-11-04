const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export const formatIDR = (value: string | number | bigint) => rupiahFormatter.format(BigInt(value));

export const formatDate = (value: string | Date, timeZone = "Asia/Makassar") =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone,
  }).format(typeof value === "string" ? new Date(`${value}T00:00:00`) : value);

export const todayISO = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const id = () => crypto.randomUUID();

export function monthRange(month: string) {
  const [year, value] = month.split("-").map(Number);
  if (!year || !value || value < 1 || value > 12) return null;
  const start = `${year}-${String(value).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
  return { start, end, year, month: value };
}

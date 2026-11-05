export const DEFAULT_PAGE_SIZE = 25;

export function parsePage(value: string | undefined): number {
  if (!value || !/^\d{1,6}$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

export function normalizeSearch(value: string | undefined, maxLength = 80): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function getPageCount(total: number, pageSize = DEFAULT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function getPageOffset(page: number, pageSize = DEFAULT_PAGE_SIZE): number {
  return (Math.max(1, page) - 1) * pageSize;
}

export function buildPageHref(
  pathname: string,
  params: Record<string, string | undefined>,
  page: number,
  pageKey = "page",
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== pageKey && value) query.set(key, value);
  }
  if (page > 1) query.set(pageKey, String(page));
  const encoded = query.toString();
  return encoded ? `${pathname}?${encoded}` : pathname;
}

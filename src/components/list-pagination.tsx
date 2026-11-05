import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildPageHref } from "@/lib/pagination";

export function ListPagination({
  pathname,
  params,
  page,
  pageCount,
  pageKey = "page",
}: {
  pathname: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  pageKey?: string;
}) {
  if (pageCount <= 1) return null;
  const previous = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);
  return (
    <nav aria-label="Navigasi halaman" className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8eeeb] px-4 py-3">
      <span className="muted text-xs">Halaman {page} dari {pageCount}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className="btn btn-secondary min-h-9" href={buildPageHref(pathname, params, previous, pageKey)}><ChevronLeft size={15} />Sebelumnya</Link> : <span className="btn btn-secondary min-h-9 opacity-50"><ChevronLeft size={15} />Sebelumnya</span>}
        {page < pageCount ? <Link className="btn btn-secondary min-h-9" href={buildPageHref(pathname, params, next, pageKey)}>Berikutnya<ChevronRight size={15} /></Link> : <span className="btn btn-secondary min-h-9 opacity-50">Berikutnya<ChevronRight size={15} /></span>}
      </div>
    </nav>
  );
}

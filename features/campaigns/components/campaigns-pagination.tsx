import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type CampaignsPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search?: string;
};

function buildHref(page: number, search?: string) {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("q", search.trim());
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/campaigns?${query}` : "/campaigns";
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);
  return pages;
}

export function CampaignsPagination({
  page,
  pageSize,
  total,
  totalPages,
  search,
}: CampaignsPaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const rangeLabel =
    total === 0 ? "Showing 0 of 0" : `Showing ${from}–${to} of ${total}`;

  if (totalPages <= 1) {
    return <span className="tw-cs">{rangeLabel}</span>;
  }

  const pages = getPageNumbers(page, totalPages);

  return (
    <>
      <span className="tw-cs">{rangeLabel}</span>
      <span className="tw-sp" />
      <Pagination className="m-0 w-auto justify-end p-0 text-[11px]">
        <PaginationContent className="gap-1.5">
          <PaginationItem>
            <PaginationPrevious
              href={buildHref(Math.max(1, page - 1), search)}
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationItem>
          {pages.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink href={buildHref(item, search)} isActive={item === page}>
                  {item}
                </PaginationLink>
              </PaginationItem>
            )
          )}
          <PaginationItem>
            <PaginationNext
              href={buildHref(Math.min(totalPages, page + 1), search)}
              aria-disabled={page >= totalPages}
              className={
                page >= totalPages ? "pointer-events-none opacity-50" : undefined
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </>
  );
}

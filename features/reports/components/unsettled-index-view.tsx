"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightIcon, FilterIcon, SearchIcon } from "lucide-react";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { DocumentNumber } from "@/components/ui/document-number";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import type { UnsettledIndexData } from "@/lib/reports/statements/unsettled-types";

type Props = {
  data: UnsettledIndexData;
};

export function UnsettledIndexView({ data }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(data.search);

  useEffect(() => {
    setSearchInput(data.search);
  }, [data.search]);

  const hasSearch = data.search.trim().length > 0;
  const hasGroupFilter = Boolean(data.groupId);
  const hasResults = data.clients.length > 0;
  const selectedGroupName =
    data.groups.find((group) => group.id === data.groupId)?.name ?? null;
  const showGroupColumn = !hasGroupFilter;

  const groupSelectOptions = useMemo(
    () => [
      { value: "", label: "All groups" },
      ...data.groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [data.groups]
  );

  const applyScope = useCallback(
    (patch: {
      search?: string;
      groupId?: string | null;
      clientType?: ClientTypeFilter;
    }) => {
      const nextSearch = patch.search ?? data.search;
      const nextGroupId =
        patch.groupId !== undefined ? patch.groupId : data.groupId;
      const nextClientType = patch.clientType ?? data.clientType;
      const params = new URLSearchParams();
      if (nextGroupId) {
        params.set("groupId", nextGroupId);
      }
      if (nextClientType !== "all") {
        params.set("clientType", nextClientType);
      }
      if (nextSearch.trim()) {
        params.set("q", nextSearch.trim());
      }
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [data.clientType, data.groupId, data.search, pathname, router]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput === data.search) return;
      applyScope({ search: searchInput });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [applyScope, data.search, searchInput]);

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm md:px-4"
        data-pending={isPending ? "true" : undefined}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <FilterIcon className="size-3.5" aria-hidden />
            Scope
          </div>

          <div className="grid min-w-[14rem] gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Group
            </Label>
            <SearchableSelect
              value={data.groupId ?? ""}
              onValueChange={(value) =>
                applyScope({ groupId: value || null, search: searchInput })
              }
              options={groupSelectOptions}
              placeholder="All groups"
              className="h-8 text-xs"
            />
          </div>

          <div className="grid min-w-[7rem] gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Client type
            </Label>
            <Select
              value={data.clientType}
              onValueChange={(value) =>
                applyScope({
                  clientType: value as ClientTypeFilter,
                  search: searchInput,
                })
              }
            >
              <SelectTrigger className="h-8 w-[7rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
                <SelectItem value="direct">Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid min-w-[16rem] flex-1 gap-1">
            <Label
              htmlFor="unsettled-search"
              className="text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              Search legal entity
            </Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="unsettled-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by client code or name…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <OperationalTableSection wide tableOnly cardSurface>
        <div className="space-y-3 px-4 py-4 md:px-6">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Client statements of unsettled
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {hasSearch && hasGroupFilter
                ? `Showing matches for "${data.search}" in ${selectedGroupName ?? "selected group"}.`
                : hasSearch
                  ? `Showing matches for "${data.search}".`
                  : hasGroupFilter
                    ? `Legal entities in ${selectedGroupName ?? "selected group"}.`
                    : "All legal entities with open AR invoices."}
            </p>
          </div>

          {!hasResults ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {hasSearch ? "No matches" : "No legal entities found"}
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                {hasSearch && hasGroupFilter
                  ? `No legal entity matches "${data.search}" in ${selectedGroupName ?? "this group"}.`
                  : hasSearch
                    ? `No legal entity matches "${data.search}".`
                    : hasGroupFilter
                      ? `No legal entities found in ${selectedGroupName ?? "this group"}.`
                      : "There are no records to display yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-[640px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 text-left font-semibold">Code</th>
                    {showGroupColumn ? (
                      <th className="px-4 py-2 text-left font-semibold">Group</th>
                    ) : null}
                    <th className="px-4 py-2 text-left font-semibold">Name</th>
                    <th className="px-4 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients.map((option) => (
                    <tr
                      key={option.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-2.5">
                        <DocumentNumber value={option.code} />
                      </td>
                      {showGroupColumn ? (
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {option.group_name ?? "—"}
                        </td>
                      ) : null}
                      <td className="px-4 py-2.5 font-medium">{option.name}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                          <Link href={`/reports/unsettled/client/${option.id}`}>
                            View unsettled
                            <ArrowRightIcon data-icon="inline-end" className="size-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </OperationalTableSection>
    </div>
  );
}

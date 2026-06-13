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
import type { StatementsIndexData } from "@/lib/reports/statements/statement-types";

type Props = {
  data: StatementsIndexData;
};

export function StatementsIndexView({ data }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(data.search);

  useEffect(() => {
    setSearchInput(data.search);
  }, [data.search]);

  const results = data.type === "client" ? data.clients : data.vendors;
  const entityLabel = data.type === "client" ? "Legal entity" : "Vendor";
  const entityLabelPlural =
    data.type === "client" ? "legal entities" : "vendors";
  const hasSearch = data.search.trim().length > 0;
  const hasGroupFilter = Boolean(data.groupId);
  const hasResults = results.length > 0;
  const selectedGroupName =
    data.groups.find((group) => group.id === data.groupId)?.name ?? null;
  const showGroupColumn = data.type === "client" && !hasGroupFilter;

  const groupSelectOptions = useMemo(
    () => [
      { value: "", label: "All groups" },
      ...data.groups.map((group) => ({ value: group.id, label: group.name })),
    ],
    [data.groups]
  );

  const applyScope = useCallback(
    (patch: {
      type?: StatementsIndexData["type"];
      search?: string;
      groupId?: string | null;
      clientType?: ClientTypeFilter;
    }) => {
      const nextType = patch.type ?? data.type;
      const nextSearch = patch.search ?? data.search;
      const nextGroupId =
        patch.groupId !== undefined ? patch.groupId : data.groupId;
      const nextClientType = patch.clientType ?? data.clientType;
      const params = new URLSearchParams();
      if (nextType !== "client") {
        params.set("type", nextType);
      }
      if (nextGroupId && nextType === "client") {
        params.set("groupId", nextGroupId);
      }
      if (nextClientType !== "all" && nextType === "client") {
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
    [data.clientType, data.groupId, data.search, data.type, pathname, router]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput === data.search) return;
      applyScope({ search: searchInput });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [applyScope, data.search, searchInput]);

  const resultHref = useMemo(
    () => (id: string) =>
      data.type === "client"
        ? `/reports/statements/client/${id}`
        : `/reports/statements/vendor/${id}`,
    [data.type]
  );

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm md:px-4"
        data-pending={isPending ? "true" : undefined}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <FilterIcon className="size-3.5" aria-hidden />
            Statement type
          </div>

          <div className="grid min-w-[8rem] gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Type
            </Label>
            <Select
              value={data.type}
              onValueChange={(value) => {
                setSearchInput("");
                applyScope({
                  type: value as StatementsIndexData["type"],
                  search: "",
                  groupId: null,
                  clientType: "all",
                });
              }}
            >
              <SelectTrigger className="h-8 w-[8.5rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client (AR)</SelectItem>
                <SelectItem value="vendor">Vendor (AP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {data.type === "client" ? (
            <>
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
            </>
          ) : null}

          <div className="grid min-w-[16rem] flex-1 gap-1">
            <Label
              htmlFor="statements-search"
              className="text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              Search {entityLabel.toLowerCase()}
            </Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="statements-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={
                  data.type === "client"
                    ? "Search by client code or name…"
                    : "Search by vendor code or name…"
                }
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
              {data.type === "client" ? "Client statements" : "Vendor statements"}
            </h2>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {hasSearch && hasGroupFilter
                ? `Showing matches for "${data.search}" in ${selectedGroupName ?? "selected group"}.`
                : hasSearch
                  ? `Showing matches for "${data.search}".`
                  : hasGroupFilter
                    ? `Legal entities in ${selectedGroupName ?? "selected group"}.`
                    : `All ${entityLabelPlural} with statement ledgers.`}
            </p>
          </div>

          {!hasResults ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {hasSearch ? "No matches" : `No ${entityLabelPlural} found`}
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                {hasSearch && hasGroupFilter
                  ? `No ${entityLabel.toLowerCase()} matches "${data.search}" in ${selectedGroupName ?? "this group"}.`
                  : hasSearch
                    ? `No ${entityLabel.toLowerCase()} matches "${data.search}".`
                    : hasGroupFilter
                      ? `No ${entityLabelPlural} found in ${selectedGroupName ?? "this group"}.`
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
                  {results.map((option) => (
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
                          <Link href={resultHref(option.id)}>
                            View statement
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

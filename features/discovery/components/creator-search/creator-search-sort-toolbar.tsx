"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CREATOR_SEARCH_SORT_FIELDS,
  defaultDirectionForSortField,
  type CreatorSearchSortDirection,
  type CreatorSearchSortField,
  type CreatorSearchSortState,
} from "./creator-search-types";

type Props = {
  sort: CreatorSearchSortState;
  onSortChange: (value: CreatorSearchSortState) => void;
  className?: string;
  showCampaignRelevance?: boolean;
};

export function CreatorSearchSortToolbar({
  sort,
  onSortChange,
  className,
  showCampaignRelevance = false,
}: Props) {
  const sortOptions = showCampaignRelevance
    ? CREATOR_SEARCH_SORT_FIELDS
    : CREATOR_SEARCH_SORT_FIELDS.filter((option) => option.value !== "relevance");

  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <ArrowUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <Select
          value={sort.field}
          onValueChange={(value) =>
            onSortChange({
              field: value as CreatorSearchSortField,
              direction: defaultDirectionForSortField(value as CreatorSearchSortField),
            })
          }
        >
          <SelectTrigger className="h-8 w-[120px] border-border bg-background text-xs sm:w-[130px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sort.direction}
          onValueChange={(value) =>
            onSortChange({ ...sort, direction: value as CreatorSearchSortDirection })
          }
        >
          <SelectTrigger className="hidden h-8 w-[108px] border-border bg-background text-xs sm:flex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">
              <span className="flex items-center gap-1.5">
                <ArrowUpIcon className="size-3" />
                Asc
              </span>
            </SelectItem>
            <SelectItem value="desc">
              <span className="flex items-center gap-1.5">
                <ArrowDownIcon className="size-3" />
                Desc
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

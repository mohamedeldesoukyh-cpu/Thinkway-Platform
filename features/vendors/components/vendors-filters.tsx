"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PLATFORM_OPTIONS,
  VENDOR_STATUS_OPTIONS,
} from "@/features/vendors/constants";

const ALL_VALUE = "__all__";

export function VendorsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const status = searchParams.get("status") ?? ALL_VALUE;
  const platform = searchParams.get("platform") ?? ALL_VALUE;

  function updateFilter(key: "status" | "platform", value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === ALL_VALUE) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    params.delete("page");

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={status}
        onValueChange={(value) => updateFilter("status", value)}
        disabled={isPending}
      >
        <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
          {VENDOR_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={platform}
        onValueChange={(value) => updateFilter("platform", value)}
        disabled={isPending}
      >
        <SelectTrigger
          className="w-full sm:w-44"
          aria-label="Filter by platform"
        >
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>All platforms</SelectItem>
          {PLATFORM_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

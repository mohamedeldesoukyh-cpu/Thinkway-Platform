"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Props = {
  statuses: { value: string; label: string }[];
};

export function IoSearchFilters({ statuses }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const status = searchParams.get("status") ?? "all";

  const apply = useCallback(
    (nextQ: string, nextStatus: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextQ.trim()) params.set("q", nextQ.trim());
      else params.delete("q");
      if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
      else params.delete("status");
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search campaign, client, influencer..."
        className="w-[280px]"
      />
      <Select value={status} onValueChange={(v) => apply(q, v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={() => apply(q, status)}>
        Apply
      </Button>
    </div>
  );
}


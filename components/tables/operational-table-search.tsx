"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { OperationalTableSearchField } from "@/components/tables/operational-table-chrome";

type OperationalTableSearchProps = {
  placeholder: string;
  paramKey?: string;
};

export function OperationalTableSearch({
  placeholder,
  paramKey = "q",
}: OperationalTableSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get(paramKey) ?? "");

  useEffect(() => {
    setValue(searchParams.get(paramKey) ?? "");
  }, [paramKey, searchParams]);

  const applySearch = useCallback(
    (nextValue: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextValue.trim()) {
        params.set(paramKey, nextValue.trim());
      } else {
        params.delete(paramKey);
      }

      params.delete("page");

      startTransition(() => {
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [paramKey, pathname, router, searchParams]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const current = searchParams.get(paramKey) ?? "";
      if (value.trim() === current.trim()) {
        return;
      }
      applySearch(value);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [applySearch, paramKey, searchParams, value]);

  return (
    <OperationalTableSearchField
      value={value}
      onChange={setValue}
      onClear={() => {
        setValue("");
        applySearch("");
      }}
      placeholder={placeholder}
      isPending={isPending}
    />
  );
}

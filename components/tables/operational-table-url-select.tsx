"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { operationalTableChrome } from "@/components/tables/operational-table-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type OperationalTableUrlSelectOption = {
  value: string;
  label: string;
};

type OperationalTableUrlSelectProps = {
  paramKey: string;
  options: OperationalTableUrlSelectOption[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

export function OperationalTableUrlSelect({
  paramKey,
  options,
  defaultValue = "",
  placeholder,
  className,
  "aria-label": ariaLabel,
}: OperationalTableUrlSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = searchParams.get(paramKey) ?? defaultValue;

  function onValueChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === defaultValue) {
      params.delete(paramKey);
    } else {
      params.set(paramKey, value);
    }

    params.delete("page");

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <Select value={current} onValueChange={onValueChange} disabled={isPending}>
      <SelectTrigger
        className={cn(operationalTableChrome.selectTrigger, className)}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
